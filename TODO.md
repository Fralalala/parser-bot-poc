## TODOs
1. Do a for loop for each Block statement of the file esprima
   1. We do not include block statements that are imports
2. Currently you are passing in the esprima of the whole file, only use the esprima of a code block
3. 

### Backlog:

- [ ] Use Trie data structure for the pathToDeclarationMap, makes much more sense
  - [ ] For a file, it must contain esprima response for that file
- [ ] Refactor `getFunctionCallsByCodeBlock` to handle classes and its internal functions
- [ ] Create a data structure that would contain these: { codeBlockString:string, esprima: esprimaObj } . This is for 

### Flow:

1. User provide a file path
2. User selects from each block statment, which to parse
   1. assumption is that everything is a declaration
3. For each of the block statement, we parse.
4. Output: We have an array of context strings
