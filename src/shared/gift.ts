// Only parse unambiguous currencies; preserve the original label for other locales.
export function parseMoney(label:string):{amount?:number;currency?:string}{
 const m=/^(JP¥|JPY|￥|¥|US\$|USD|€|EUR|£|GBP)\s*([\d,]+(?:\.\d+)?)$/.exec(label.trim());
 if(!m)return {};const amount=Number(m[2].replace(/,/g,''));
 const currency:Record<string,string>={'JP¥':'JPY',JPY:'JPY','￥':'JPY','¥':'JPY','US$':'USD',USD:'USD','€':'EUR',EUR:'EUR','£':'GBP',GBP:'GBP'};
 return Number.isFinite(amount)?{amount,currency:currency[m[1]]}:{};
}
