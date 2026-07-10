/**
 * 共享类型定义 —— 前后端共享的领域模型
 * 见 CONTEXT.md 术语表与 ADR-0004（schema 定义）
 */
import type { ActivityType } from './enums.js';

/**
 * 已完成的活动记录（归档）
 * 对应后端 SQLite 的 sessions 表
 */
export interface ActivitySession {
  /** 唯一标识（UUID） */
  id: string;
  /** 活动类型（STUDY | READING） */
  type: ActivityType;
  /** 发生日期 YYYY-MM-DD（保留列，跨天记录由用户指定，不从 startTime 派生） */
  date: string;
  /** 开始时间戳（epoch ms，后端权威） */
  startTime: number;
  /** 结束时间戳（epoch ms） */
  endTime: number;
  /** 时长（秒） */
  duration: number;
  /** 活动内容描述 */
  content: string;
}

/**
 * 运行中的活动会话（进行中会话）
 * 对应后端 SQLite 的 active_session 单行表（始终最多一行）
 * 时长 = 结算点 − startTime，结算点见 ADR-0004/CONTEXT.md
 */
export interface ActiveSession {
  id: string;
  type: ActivityType;
  /** 开始时间戳（epoch ms，后端权威） */
  startTime: number;
  /** 最后一次有效心跳时刻（epoch ms） */
  lastHeartbeatAt: number;
  content: string;
}

/** 统计图表数据点 */
export interface ChartDataPoint {
  /** 横轴标签（如 "7月9日" / "26年7月"） */
  label: string;
  /** 学习类时长（已按图表单位换算） */
  study: number;
  /** 阅读类时长（已按图表单位换算） */
  reading: number;
}

/** 自适应时间格式化返回值（统计汇总用） */
export interface FormattedTime {
  value: string;
  unit: string;
}

/** 统计结果完整结构（后端聚合后返回前端） */
export interface StatisticsData {
  chartData: ChartDataPoint[];
  /** 图表单位（"小时" | "分钟" | "秒"），基于两类型全局最大值判定 */
  chartUnit: string;
  studyTotal: FormattedTime;
  readingTotal: FormattedTime;
  studyAvg: FormattedTime;
  readingAvg: FormattedTime;
  studyDays: number;
  readingDays: number;
  /** 范围内总天数 */
  totalDaysInRange: number;
}

/** 统计时间范围 */
export type RangeType = '7' | '14' | '30' | 'year';

/** 所有合法的范围值（单一事实源，路由层校验复用，避免字面量重复） */
export const RANGE_VALUES: readonly RangeType[] = ['7', '14', '30', 'year'];
