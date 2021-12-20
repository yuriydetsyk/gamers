function shuffleArray<T>(array: T[]) {
    const newArray: T[] = JSON.parse(JSON.stringify(array));
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }

    return newArray;
}

function getRandomItem<T>(array: T[]) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomMapItem<T, K>(set: Map<T, K>) {
    return getRandomItem(Array.from(set));
}

function reorderArray<T>(array: T[], index: number) {
    return array.slice(index).concat(array.slice(0, index));
}

function flatten<T>(array: T[]) {
    return array.reduce((flat, toFlatten) => {
        return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
    }, []);
}

export { shuffleArray, getRandomItem, getRandomMapItem, reorderArray, flatten };
