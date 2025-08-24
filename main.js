import { readFileSync, readdirSync, statSync } from "fs";
import { format } from "prettier";
import esprima from "esprima";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const supportedTypes = [
    esprima.Syntax.ExportNamedDeclaration,
    esprima.Syntax.VariableDeclaration,
];
const supportedImports = [
    esprima.Syntax.ImportDefaultSpecifier,
    esprima.Syntax.ImportSpecifier,
];

const repositoryName = "parser-bot";

const pathCodeBlocks = new Map();
const importDeclarationsNames = {};
const pathCalls = {};

// TODO: Enable folder path, so we check on each files of the folder
const servicePath =
    "/Users/sirol/Desktop/projects/parser-bot/inner-main/file.js";
const importPath =
    "/Users/sirol/Desktop/projects/parser-bot/someFolder/utility.js";

const getPrettyfiedFile = async (filePath) => {
    // add checker if it exists
    const code = readFileSync(filePath, "utf-8");
    return await format(code, { parser: "babel" });
};

const getImportFilePathFromRelativePath = (importPath, currentPath) => {
    // u ahve to check if this is always a file path or file/folder path
    const initialStructure = currentPath.split("/").filter((e) => e);

    if (statSync(currentPath).isFile()) initialStructure.pop();

    const pathArr = importPath.split("/");

    let lastIndex = 0;

    pathArr.some((segment, index) => {
        if (segment === "..") {
            initialStructure.pop();
            return false;
        }

        lastIndex = index + (segment === "." ? 1 : 0);

        return true;
    });

    for (let index = lastIndex; index < pathArr.length; index++) {
        const element = pathArr[index];

        initialStructure.push(element);
    }

    initialStructure[initialStructure.length - 1] += ".js";

    return "/" + initialStructure.join("/");
};

const visitedPaths = new Set();

// let pathToDeclarationMap = {};
let declarationToPathMap = {};

const dfs = async (path, pathToDeclarationMap = {}) => {
    if (visitedPaths.has(path)) return;

    const code = await getPrettyfiedFile(path);
    const esprimaResponse = esprima.parseModule(code, { loc: true });

    const fileData = getCodeBlocksByPath(code, path, esprimaResponse);
    const paths = getImportPathsByFilePath(esprimaResponse);

    pathToDeclarationMap = { ...pathToDeclarationMap, ...fileData };

    visitedPaths.add(path);

    for (let index = 0; index < paths.length; index++) {
        const importFilePath = getImportFilePathFromRelativePath(
            paths[index],
            servicePath
        );

        const res = await dfs(importFilePath, pathToDeclarationMap);

        Object.entries(res.pathToDeclarationMap).forEach((entry) => {
            const [key, value] = entry;
            Object.keys(value).forEach((names) => {
                declarationToPathMap[names] = key;
            });
        });

        pathToDeclarationMap = {
            ...pathToDeclarationMap,
            ...res.pathToDeclarationMap,
        };
    }

    return {
        // redundant data if we already have it in pathToDeclaration
        // code: fileData,
        importVariables: esprimaResponse.body
            .map((obj) => getImportVariables(obj))
            .flat(),
        esprimaResponse,
        pathToDeclarationMap,
        codeBlock: code,
    };
};

const getImportPathsByFilePath = (esprimaResponse) => {
    const importPaths = [];

    esprimaResponse.body.forEach((body) => {
        if (
            body.type === esprima.Syntax.ImportDeclaration &&
            body.source.type === esprima.Syntax.Literal &&
            body.source.value.includes("./")
        ) {
            importPaths.push(body.source.value);
        }
    });

    return importPaths;
};

const getCodeBlocksByPath = (code, path, esprimaResponse) => {
    const codeLines = code.split("\n");

    const fileData = {};

    if (!fileData[path]) fileData[path] = {};

    esprimaResponse.body.forEach((body) => {
        let declarations = [];

        if (body.type === esprima.Syntax.VariableDeclaration)
            declarations = body.declarations;
        else if (
            body.type === esprima.Syntax.ExportNamedDeclaration &&
            body.declaration
        )
            declarations = body.declaration.declarations;

        declarations.forEach((declaration) => {
            if (declaration.type === esprima.Syntax.VariableDeclarator) {
                const name = declaration.id.name;
                const code = codeLines
                    .slice(
                        declaration.loc.start.line - 1,
                        declaration.loc.end.line + 1
                    )
                    .join("\n");

                fileData[path][name] = {
                    code,
                    location: {
                        start: declaration.loc.start.line,
                        end: declaration.loc.end.line,
                    },
                };
            }
        });
    });

    return fileData;
};

/**
 * Given an Esprima CallExpression Object, we will extract the call name.
 * Example of a call name: `console.log` , `res.send.some.func`, etc
 * @param {type} obj - Call Expression object
 * @returns {type} Description of the return value.
 */
const getCallsByCallExpression = (obj) => {
    if (obj.type !== esprima.Syntax.CallExpression) {
        return [];
    }

    const callNames = [];
    const callStack = [];

    let isDefined = true;
    let callee = obj.callee;

    while (isDefined) {
        if (callee.hasOwnProperty("object")) {
            callStack.push(callee.property.name);
            callee = callee.object;
        } else {
            callStack.push(callee.name);
            isDefined = false;
        }
    }

    callNames.push(callStack.reverse().join("."));

    // might be inefficient to flat
    if (obj.hasOwnProperty("arguments")) {
        for (let index = 0; index < obj.arguments.length; index++) {
            const arg = obj.arguments[index];

            callNames.push(getCallsByCallExpression(arg));
        }
    }

    return callNames.flat();
};

const getCallByExpressionStatement = (obj) => {
    if (obj.type !== esprima.Syntax.ExpressionStatement) {
        return null;
    }

    return getCallsByCallExpression(obj.expression);
};

// add an option for unique?
const getFunctionCallsByCodeBlock = (
    esprimaResponse,
    removeDuplicates = false
) => {
    const callNames = [];

    esprimaResponse.body.forEach((body) => {
        let declarations = [];

        if (body.type === esprima.Syntax.VariableDeclaration)
            declarations = body.declarations;
        else if (
            body.type === esprima.Syntax.ExportNamedDeclaration &&
            body.declaration
        )
            declarations = body.declaration.declarations;

        declarations.forEach((declaration) => {
            declaration.init.body.body.forEach((blockStatement) => {
                if (
                    blockStatement.type === esprima.Syntax.ExpressionStatement
                ) {
                    const funcCallName =
                        getCallByExpressionStatement(blockStatement);

                    callNames.push(funcCallName);
                }
            });
        });
    });

    const res = callNames.flat();

    if (removeDuplicates) return Array.from(new Set(res));

    return res;
};

/*

Iterate through a block statement

The idea is to get all function calls that is not within the block statement

If you get a variable declaration, then it's function call right after, 
then we remove it from the list of calls.

We should probably return two arrays, one to fetch all called functions
another for returning calls that doesnt have it's declaration in the block statement

*/

const getImportVariables = (obj) => {
    if (obj?.type !== esprima.Syntax.ImportDeclaration) return [];
    return obj.specifiers.map((specifier) => ({
        localName: specifier.local.name,
        importName: specifier.imported.name,
    }));
};

/**
 * Gets expression names that is not initiated within the code block
 * Example of a call name: `console.log` , `res.send.some.func`, etc
 * @param {type} obj - Call Expression object
 * @returns {type} Description of the return value.
 */
const getNoSourceCallNames = (blocks, importDeclarations = []) => {
    // this should also contain the parameters
    const declaredSet = new Set(importDeclarations); // initialize with what we have from file imports

    const expressions = [];

    const dfs = (blockStatements) => {
        blockStatements.forEach((obj) => {
            switch (obj.type) {
                case esprima.Syntax.ExpressionStatement:
                    const callNames = getCallByExpressionStatement(obj);

                    for (let name of callNames) {
                        name = name.split(".")[0];

                        if (!declaredSet.has(name)) {
                            expressions.push(name);
                            declaredSet.add(name);
                        }
                    }

                    break;
                case esprima.Syntax.VariableDeclaration:
                    dfs(obj.declarations);

                    break;

                case esprima.Syntax.VariableDeclarator:
                    declaredSet.add(obj.id.name);

                    dfs(obj.init.body.body);

                    break;

                case esprima.Syntax.ExportNamedDeclaration:
                    dfs(obj.declaration.declarations);

                    break;

                default:
                    // console.error(
                    //     "Unhandled type in block statment filter process",
                    //     obj.type
                    // );
                    break;
            }
        });
    };

    dfs(blocks);


    return expressions;
};

const getExpressionParameters = (esprimaObj) => {
    const parameters = [];

    const dfs = (obj) => {
        switch (obj.type) {
            case esprima.Syntax.ExportNamedDeclaration:
                dfs(obj.declaration);
                break;

            case esprima.Syntax.VariableDeclaration:
                for (const declaration of obj.declarations) {
                    if (declaration.init?.params) {
                        for (const param of declaration.init.params) {
                            parameters.push(param.name);
                        }
                    }
                }
                break;

            default:
                // console.error("found an expression we dont support", obj.type);
                break;
        }
    };

    for (const body of esprimaObj.body) {
        dfs(body);
    }

    return parameters;
};

const findBlockByName = ( name, esprimaBody ) => {

    

}

const main = async () => {
    try {
        const filePaths = [servicePath];

        for (const path of filePaths) {
            const {
                code,
                importVariables,
                esprimaResponse,
                pathToDeclarationMap,
            } = await dfs(path);

            for (const block of Object.values(pathToDeclarationMap[servicePath])) {
                const codeBlock = block["code"];

                // should only use esprimaResponse of the codeBlock
                const expressionCalls = getFunctionCallsByCodeBlock(
                    esprimaResponse,
                    true
                );

                const codeEsprima = esprima.parseModule(codeBlock, { loc: true });

                const importLocalNames = importVariables.map(
                    (obj) => obj.localName
                );

                // should only use esprimaResponse of the codeBlock
                const noSourceCallNames = getNoSourceCallNames(
                    codeEsprima.body,
                    [
                        // the arr below are calls from parameters
                        ...getExpressionParameters(codeEsprima), // should we always do this? we can do this internally
                    ]
                )
                    // TODO: we should also check the names inside the file
                    // since it's possible for calls to have codes that references
                    // variables inside of the file. JS has a concept of `hoisting`, review it
                    // hoisting simplifies things, so we dont need to filter out all declared
                    // calls in a file
                    // Will only return no source call names that are from the imports
                    .filter((name) => importLocalNames.includes(name));

                const importCodeBlocks = noSourceCallNames.map((name) => {
                    const nameObj = importVariables.find(
                        (nameObj) => nameObj.localName === name
                    );

                    return pathToDeclarationMap[importPath][nameObj.importName]
                        ?.code;
                });

                const context = `Main code:\n${codeBlock}\n---------\nReferenced Codes:\n${importCodeBlocks.join(`\n---------\n`)}`;

                console.log(context);

                console.log('==========')

            }
        }
    } catch (error) {
        console.log(error);
    }
};

main();
