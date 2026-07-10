/**
 * 时钟注入 —— 业务层通过此模块取当前时间，便于测试注入伪时钟
 * 计时/结算/超时逻辑强依赖时钟，直接调 Date.now() 无法精确复现超时/抢占
 */
export interface Clock {
  /** 返回当前时间戳（epoch ms） */
  now(): number;
}

/** 生产时钟：直接 Date.now() */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** 测试用伪时钟：可推进时间精确复现超时/心跳/抢占 */
export class FakeClock implements Clock {
  private current: number;

  constructor(initial: number = 0) {
    this.current = initial;
  }

  now(): number {
    return this.current;
  }

  /** 推进指定毫秒 */
  advance(ms: number): void {
    this.current += ms;
  }
}
