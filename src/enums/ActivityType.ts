// 活动类型枚举：区分学习与阅读记录
import { Enumify } from 'enumify';

export class ActivityType extends Enumify {
  /** 学习类活动 */
  static STUDY = new ActivityType();
  /** 阅读类活动 */
  static READING = new ActivityType();
  static _ = this.closeEnum();
}
