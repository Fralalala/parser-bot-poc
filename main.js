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

const getPrettyfiedFile = async (filePath) => {
    // add checker if it exists
    const code = readFileSync(filePath, "utf-8");
    return await format(code, { parser: "babel" });
};

const getCodeBlocks = (code) => {
    const codeLines = code.split("\n");
    const esprimaResponse = esprima.parseModule(code, { loc: true });

    const data = {
        importPaths: [],
        blocks: [],
        fucntions: [],
    };

    esprimaResponse.body.forEach((body) => {
        const { start, end } = body.loc;
        let functionName = "N/A";

        if (supportedTypes.includes(body.type)) {
            functionName =
                body?.declaration?.declarations.find(
                    (obj) => obj.id.type === esprima.Syntax.Identifier
                )?.id?.name || functionName;
        } else if (body.type === esprima.Syntax.VariableDeclaration) {
            functionName = body.declarations.find(
                (obj) => obj.id.type === esprima.Syntax.Identifier
            ).id.name;
        }

        if (body.type === esprima.Syntax.ImportDeclaration) {
            body.source.value && data.importPaths.push(body.source.value);

            body.specifiers.forEach((specifier) => {
                if (supportedImports.includes(specifier.type)) {
                    const code = "";

                    importDeclarationsNames[specifier.local.name] = {
                        type: specifier.type,
                        importPath: body.source.value,
                        name: specifier.local.name,
                        code: code,
                    };
                }
            });
        } else
            data.blocks.push(
                codeLines.slice(start.line - 1, end.line).join("\n")
            );
    });

    return data;
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

let fileDataLedger = {};

const dfs = async (path) => {
    if (visitedPaths.has(path)) return;

    // const code = await getPrettyfiedFile(path);

    // const { importPaths, blocks } = getCodeBlocks(code);

    const fileData = await getCodeBlocksByPath(path);
    const paths = await getImportPathsByPath(path);

    fileDataLedger = { ...fileDataLedger, ...fileData };

    visitedPaths.add(path);

    for (let index = 0; index < paths.length; index++) {
        const importFilePath = getImportFilePathFromRelativePath(
            paths[index],
            servicePath
        );

        console.log("importFilePath", importFilePath);

        await dfs(importFilePath);
    }
};

const getImportPathsByPath = async (path) => {
    const code = await getPrettyfiedFile(path);
    const codeLines = code.split("\n");

    const esprimaResponse = esprima.parseModule(code, { loc: true });

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

const getCodeBlocksByPath = async (path) => {
    const code = await getPrettyfiedFile(path);
    const codeLines = code.split("\n");

    const fileData = {};

    if (!fileData[path]) fileData[path] = {};

    const esprimaResponse = esprima.parseModule(code, { loc: true });

    esprimaResponse.body.forEach((body) => {
        // Parses a variable and saves its code block

        let declarations = [];

        if (body.type === esprima.Syntax.VariableDeclaration) {
            declarations = body.declarations;
        } else if (
            body.type === esprima.Syntax.ExportNamedDeclaration &&
            body.declaration
        ) {
            declarations = body.declaration.declarations;
        }

        declarations.forEach((declaration) => {
            if (declaration.type === esprima.Syntax.VariableDeclarator) {
                const name = declaration.id.name;
                const codeBlock = codeLines.slice(
                    declaration.loc.start.line - 1,
                    declaration.loc.end.line + 1
                );

                fileData[path][name] = codeBlock;
            }
        });
    });

    return fileData;
};

const main = async () => {
    try {
        await dfs(servicePath);

        // console.log(pathCodeBlocks);

        console.log(fileDataLedger);

        // Array.from(pathCodeBlocks).forEach((entry) => {
        //     const [key, value] = entry;

        //     for (let index = 0; index < value.length; index++) {
        //         const codeBlock = value[index];

        //         const importFunctions = getFunctionCallsByCodeBlock(codeBlock);

        //         console.log(importFunctions);
        //     }
        // });

        /* 
            Last TODO:

            Note: When variable/function names are repeated, the previously found
            name is overwritten

            1.  Per import, get all declared variables and functions

                Structure the data as:
                <variable_name> : <import_path>

                To allow quick look ups for later.

            2.  Get all variable/function names per code block.
            
            3.  Intialize a string. This is where you'll place all related code blocks

            4.  Per each of the names, check if they are part of the code imports
                if they are, get their respective code block (need to make this code)
                and add it in the Initialized String.
                else do nothing
        */
    } catch (error) {
        console.log(error);
    }
};

main();
