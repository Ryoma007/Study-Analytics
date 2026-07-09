import { ActivityType } from '../enums/ActivityType';

/**
 * 活动类型的展示配置接口
 * 将 ActivityType 映射到所有 UI 展示属性，作为单一事实源
 */
export interface ActivityConfig {
  /** 中文标签 */
  label: string;
  /** 颜色配置（Tailwind CSS 类名 + 十六进制） */
  color: {
    /** 十六进制颜色值（recharts 等图表库使用） */
    hex: string;
    /** Tailwind CSS 类名 */
    tailwind: {
      /** 主题色名称（如 'indigo'、'emerald'） */
      primary: string;
      /** Logo 背景 */
      logoBg: string;
      /** 导航选中背景 */
      activeBg: string;
      /** 导航选中文字 */
      activeText: string;
      /** 导航图标颜色 */
      iconColor: string;
      /** 主按钮（含阴影和 hover） */
      btn: string;
      /** 输入框聚焦环 */
      focusRing: string;
    };
  };
  /** 文案配置 */
  copy: {
    /** 计时器标题 */
    heading: string;
    /** 输入框标签 */
    label: string;
    /** 输入框占位符 */
    placeholder: string;
    /** 未填写内容时的默认保存值 */
    defaultContent: string;
    /** 历史页空状态文案 */
    emptyHistory: string;
    /** 历史页标题 */
    historyTitle: string;
  };
}

/** 活动类型 → 展示配置的映射表 */
const CONFIG_MAP: Record<string, ActivityConfig> = {
  STUDY: {
    label: '学习',
    color: {
      hex: '#6366f1',
      tailwind: {
        primary: 'indigo',
        logoBg: 'bg-indigo-600',
        activeBg: 'bg-indigo-50',
        activeText: 'text-indigo-700',
        iconColor: 'text-indigo-600',
        btn: 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700',
        focusRing: 'focus:ring-indigo-500 focus:border-indigo-500',
      },
    },
    copy: {
      heading: '当前学习',
      label: '你在学习什么？（选填）',
      placeholder: '例如：React Hooks，微积分，高等数学...',
      defaultContent: '日常学习',
      emptyHistory: '暂无学习记录。开始学习吧！',
      historyTitle: '学习历史',
    },
  },
  READING: {
    label: '阅读',
    color: {
      hex: '#059669',
      tailwind: {
        primary: 'emerald',
        logoBg: 'bg-emerald-600',
        activeBg: 'bg-emerald-50',
        activeText: 'text-emerald-700',
        iconColor: 'text-emerald-600',
        btn: 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700',
        focusRing: 'focus:ring-emerald-500 focus:border-emerald-500',
      },
    },
    copy: {
      heading: '当前阅读',
      label: '你在读什么？（选填）',
      placeholder: '例如：深入理解计算机系统，三体，设计模式...',
      defaultContent: '日常阅读',
      emptyHistory: '暂无阅读记录。开始阅读吧！',
      historyTitle: '阅读历史',
    },
  },
};

/**
 * 根据 ActivityType 实例获取对应的展示配置
 * @param type ActivityType 枚举实例
 * @returns 对应的 ActivityConfig
 */
export function getActivityConfig(type: ActivityType): ActivityConfig {
  return CONFIG_MAP[type];
}

/** 配置映射表（供需要遍历所有类型的场景使用） */
export { CONFIG_MAP as ACTIVITY_CONFIG_MAP };
