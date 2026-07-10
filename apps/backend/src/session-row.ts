/**
 * 后端共享的 DB 行类型 —— sessions 表的 snake_case 映射
 * 各服务按需读取字段子集，但共享同一类型避免重复定义
 */
export interface SessionRow {
  id: string;
  type: string;
  date: string;
  start_time: number;
  end_time: number;
  duration: number;
  content: string;
}
