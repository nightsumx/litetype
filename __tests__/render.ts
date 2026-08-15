import type { SafeParseResult } from '../src/error'

// 把校验结果转成稳定字符串供快照：成功 `OK <json>`；失败把 issues 按 path 排序后逐行
// `path: message`（path 空 → <root>）。排序保证多错时确定序（与 collect-all 对齐）。
export function render(r: SafeParseResult<unknown>): string {
    if (r.success)
        return `OK ${stable(r.data)}`
    const lines = r.error.issues
        .map((i) => {
            const at = i.path.length ? i.path.map(String).join('.') : '<root>'
            // union 伞 issue 的 message 多行（内嵌每支原因）；首行带 path+code，续行原样缩进。
            const [head, ...rest] = i.message.split('\n')
            const first = `${at}: ${head} [${i.code}]`
            return rest.length ? `${first}\n${rest.join('\n')}` : first
        })
        .sort()
    return `FAIL\n${lines.join('\n')}`
}

function stable(v: unknown): string {
    // JSON.stringify 会先调 Date.toJSON()，replacer 拿到的已是 ISO 串 —— 故 instanceof 永不命中。
    // 顶层 Date 单独处理，让快照明确显示是 Date 而非字符串（否则「错返 ISO 串」会与正确无法区分）。
    if (v instanceof Date)
        return `Date(${v.toISOString()})`
    // JSON.stringify 把 Infinity/-Infinity/NaN 全压成 null —— 快照会说谎（看着像返回了 null）。
    // replacer 拿到的是原值（序列化前），非有限数显式标成 Number(...)，让对抗 case 的真实输出可见。
    return JSON.stringify(v, (_k, val) =>
        typeof val === 'number' && !Number.isFinite(val) ? `Number(${String(val)})` : val)
}
