import { readFileSync, readdirSync, statSync } from "fs";
import { format } from "prettier";
import esprima from "esprima";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const supportedTypes = [esprima.Syntax.ExportNamedDeclaration];

const repositoryName = "parser-bot";

const pathCodeBlocks = new Map();

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
        fucntions: []
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

        if (body.type === esprima.Syntax.ImportDeclaration)
            body.source.value && data.importPaths.push(body.source.value);
        else
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

const dfs = async (path) => {
    if (pathCodeBlocks.has(path)) return;

    const code = await getPrettyfiedFile(path);

    const { importPaths, blocks } = getCodeBlocks(code);

    pathCodeBlocks.set(path, blocks);

    for (let index = 0; index < importPaths.length; index++) {
        const importFilePath = getImportFilePathFromRelativePath(
            importPaths[index],
            servicePath
        );

        await dfs(importFilePath);
    }
};

const generateFunctionNamesPerImport = async  (path) => {
    const code = await getPrettyfiedFile(path);

    const { importPaths, blocks } = getCodeBlocks(code);

}

const getFunctionCallsByCodeBlock = (codeBlock) => {

    // const esprimaResponse = esprima.parseModule(codeBlock, { loc: true });
    
    // esprimaResponse.body.forEach(block => {

    //     block.declaration.declarations.forEach(el => {

    //         el.init.body.forEach()

    //     })

    // })    

}

const main = async () => {
    try {
        await dfs(servicePath);

        console.log(pathCodeBlocks);

        Array.from(pathCodeBlocks).forEach((entry) => {
            const [key, value] = entry

            for (let index = 0; index < value.length; index++) {
                const codeBlock = value[index];

                const importFunctions = getFunctionCallsByCodeBlock(codeBlock)

                console.log(importFunctions)

                
            }

        });

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
