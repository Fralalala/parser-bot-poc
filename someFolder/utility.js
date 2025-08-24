const stringHelper = (word = 'default word') => {
    console.log("some words", word);

    return `hello ${word}`;
};

const lsome = () => {
    someWords()
}

export { stringHelper, lsome };
