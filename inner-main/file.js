import { stringHelper } from "../someFolder/utility";


export const pingProducts = (req, res) => {
    console.log("Pinged products controller");

    const stringHelper = 'sad'

    console.log(stringHelper)

    res.send("Pinged products");
};

export const somethign = (req, res) => {
    console.log("Pinged products controller");
    res.send("Pinged products");
};

export const heheh = (req, res) => {
    console.log("Pinged products controller");
    res.send("Pinged products");
};
