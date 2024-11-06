export interface ProfilerItem {
    name: string
    start: number
    stop: number
}

export class Profiler {
    private start: number
    private stop: number
    private list: ProfilerItem[]

    constructor() {
        const now = Date.now()
        this.start = now
        this.stop = now
        this.list = []
    }

    public tick(name: string) {
        const now = Date.now()
        this.list.push({
            name,
            start: this.stop,
            stop: now,
        })
        this.stop = now
    }

    public toString() {
        const list = this.list.map((i) => {
            return { ...i, duration: i.stop - i.start }
        })

        list.push({
            name: 'TOTAL',
            start: this.start,
            stop: this.stop,
            duration: this.stop - this.start,
        })
        return list.filter((i) => i.duration > 10)
    }
}
