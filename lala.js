const sampleFunc = () => {
    const foo = () => {
            console.log("internal func");
        },
        wow = () => {
            console.log("another log");
        },
        num = 42;

    foo();
};

const foo = () => {
    console.log("asidj");
};

sampleFunc();
