function getMultilineText(text: string) {
    return text.replace(/\\n/g, '\n');
}

function pascalCaseToUnderscore(text: string) {
    return text.split(/(?=[A-Z])/).join('_').toLowerCase();
}

export { getMultilineText, pascalCaseToUnderscore };
