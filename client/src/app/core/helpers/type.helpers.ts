const isNil = (val: any) => isNull(val) || isUndefined(val);
const isNull = (val: any) => val === null;
const isUndefined = (val: any) => val === undefined;
const isBoolean = (val: any) => typeof val === 'boolean';

export { isNil, isNull, isUndefined, isBoolean };
