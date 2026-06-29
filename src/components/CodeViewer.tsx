import type React from 'react';
import styles from './CodeViewer.module.css';

/* -- Tiny inline helpers -- */
const Cmt  = ({ t }: { t: string }) => <span className={styles.cmt}>{t}</span>;
const Fn   = ({ t }: { t: string }) => <span className={styles.fn}>{t}</span>;
const Str  = ({ t }: { t: string }) => <span className={styles.str}>{t}</span>;
const Op   = ({ t }: { t: string }) => <span className={styles.op}>{t}</span>;
const Va   = ({ t }: { t: string }) => <span className={styles.va}>{t}</span>;

interface LineProps { n: number; children?: React.ReactNode }
const L = ({ n, children }: LineProps) => (
  <div className={styles.line}>
    <span className={styles.ln}>{String(n).padStart(2, ' ')}</span>
    <span className={styles.lc}>{children ?? ' '}</span>
  </div>
);

const I = ({ level = 1 }: { level?: number }) => (
  <>{Array.from({ length: level }).map((_, i) => (
    <span key={i} className={styles.indent} />
  ))}</>
);

export default function CodeViewer() {
  return (
    <div className={styles.panel}>
      {/* -- Header -- */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.fileIcon}>&#x2B21;</span>
          <span className={styles.filename}>reconcile<span className={styles.sep}>.</span>py</span>
        </div>
        <span className={styles.badge}>对账流程</span>
      </div>

      {/* -- Code body -- */}
      <div className={styles.body}>
        <div className={styles.scanline} aria-hidden />

        <div className={styles.code}>
          {/* ═══ Step 1: Receive Data ═══ */}
          <L n={1}>
            <Cmt t="# 步骤1：接收对账数据" />
          </L>
          <L n={2}>
            <Va t="order_df" /><Op t=" = " />
            <Fn t="load_data" /><Op t="(" /><Str t='"订单表.xlsx"' /><Op t=")" />
          </L>
          <L n={3}>
            <Va t="payment_df" /><Op t=" = " />
            <Fn t="load_data" /><Op t="(" /><Str t='"收款流水.csv"' /><Op t=")" />
          </L>
          <L n={4}>
            <Va t="bill_df" /><Op t=" = " />
            <Fn t="load_data" /><Op t="(" /><Str t='"平台账单.xlsx"' /><Op t=")" />
          </L>
          <L n={5} />

          {/* ═══ Step 2: Duplicate Check ═══ */}
          <L n={6}>
            <Cmt t="# 步骤2：单表自查 — 重复记录检测" />
          </L>
          <L n={7}>
            <Va t="dup_orders" /><Op t=" = " />
            <Fn t="find_duplicates" /><Op t="(" /><Va t="order_df" /><Op t=", " />
            <Va t="key" /><Op t="=" /><Str t='"order_id"' /><Op t=")" />
          </L>
          <L n={8}>
            <Va t="dup_payments" /><Op t=" = " />
            <Fn t="find_duplicates" /><Op t="(" /><Va t="payment_df" /><Op t=", " />
            <Va t="key" /><Op t="=" /><Str t='"transaction_id"' /><Op t=")" />
          </L>
          <L n={9} />

          {/* ═══ Step 3: Cross-match ═══ */}
          <L n={10}>
            <Cmt t="# 步骤3：跨表核对 — 一方有、另一方没有" />
          </L>
          <L n={11}>
            <Va t="order_only" /><Op t=", " /><Va t="pay_only" /><Op t=", " />
            <Va t="matched" /><Op t=" = " />
            <Fn t="cross_match" /><Op t="(" />
            <Va t="order_df" /><Op t=", " /><Va t="payment_df" /><Op t=", " />
            <Va t="on" /><Op t="=" /><Str t='"order_id"' /><Op t=")" />
          </L>
          <L n={12} />

          {/* ═══ Step 4: Amount Compare ═══ */}
          <L n={13}>
            <Cmt t="# 步骤4：金额比对 — 同号金额不一致" />
          </L>
          <L n={14}>
            <Va t="amount_mismatch" /><Op t=" = " />
            <Fn t="compare_amount" /><Op t="(" />
            <Va t="matched" /><Op t=", " />
            <Va t="col_a" /><Op t="=" /><Str t='"amount_x"' /><Op t=", " />
            <Va t="col_b" /><Op t="=" /><Str t='"amount_y"' /><Op t=")" />
          </L>
          <L n={15} />

          {/* ═══ Step 5: Status Check ═══ */}
          <L n={16}>
            <Cmt t="# 步骤5：状态一致性检查" />
          </L>
          <L n={17}>
            <Va t="status_mismatch" /><Op t=" = " />
            <Fn t="check_status" /><Op t="(" />
            <Va t="matched" /><Op t=", " />
            <Str t='"order_status"' /><Op t=", " /><Str t='"payment_status"' /><Op t=")" />
          </L>
          <L n={18} />

          {/* ═══ Step 6: Time Anomaly ═══ */}
          <L n={19}>
            <Cmt t="# 步骤6：时间异常检测" />
          </L>
          <L n={20}>
            <Va t="time_anomaly" /><Op t=" = " />
            <Fn t="check_time" /><Op t="(" />
            <Va t="matched" /><Op t=", " />
            <Str t='"pay_time"' /><Op t=", " /><Str t='"order_time"' /><Op t=")" />
          </L>
          <L n={21} />

          {/* ═══ Step 7: Report ═══ */}
          <L n={22}>
            <Cmt t="# 步骤7：生成差异报告" />
          </L>
          <L n={23}>
            <Fn t="generate_report" /><Op t="(" />
          </L>
          <L n={24}>
            <I /><Va t="order_only" /><Op t="=" /><Va t="order_only" /><Op t="," />
          </L>
          <L n={25}>
            <I /><Va t="pay_only" /><Op t="=" /><Va t="pay_only" /><Op t="," />
          </L>
          <L n={26}>
            <I /><Va t="amount_mismatch" /><Op t="=" /><Va t="amount_mismatch" /><Op t="," />
          </L>
          <L n={27}>
            <I /><Va t="duplicates" /><Op t="=" /><Va t="dup_orders" /><Op t=" + " />
            <Va t="dup_payments" /><Op t="," />
          </L>
          <L n={28}>
            <I /><Va t="status_mismatch" /><Op t="=" /><Va t="status_mismatch" /><Op t="," />
          </L>
          <L n={29}>
            <I /><Va t="time_anomaly" /><Op t="=" /><Va t="time_anomaly" /><Op t="," />
          </L>
          <L n={30}>
            <Op t=")" />
          </L>
        </div>
      </div>

      {/* -- Footer tag -- */}
      <div className={styles.footer}>
        <span className={styles.footerDot} />
        <span>多表核对 · 逐条比对 · 差异报告</span>
      </div>
    </div>
  );
}
