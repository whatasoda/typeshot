export const getSymbolName = (symbol: symbol): string => symbol.toString().slice(/* Symbol( */ 7, /* ) */ -1);
