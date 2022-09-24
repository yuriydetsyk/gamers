function randomIntFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomIntFromArray(array: number[]) {
    return array[Math.floor(Math.random() * array.length)];
}

function create<T>(c: new() => T) {
    return new c();
}

export { randomIntFromInterval, randomIntFromArray, create };
