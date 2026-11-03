'use client';

import { useState } from 'react';
import styles from './marketing.module.css';

export default function TimeSavingsCalculator() {
  const [jobs, setJobs] = useState(30);
  const [seconds, setSeconds] = useState(45);
  const [days, setDays] = useState(26);
  const hours = jobs * seconds * days / 3600;
  return <div className={styles.calculator}>
    <div><p className={styles.eyebrow}>Your numbers, your estimate</p><h3>What could less file handling mean for your shop?</h3><p>Estimate time spent receiving files and entering settings. This is an illustration, not a measured ScanItPrintIt result.</p></div>
    <div className={styles.calculatorInputs}>
      <label htmlFor="daily-jobs">Jobs per day <output>{jobs}</output><input id="daily-jobs" type="range" min="0" max="200" step="5" value={jobs} onChange={e => setJobs(Number(e.target.value))} /></label>
      <label htmlFor="handling-seconds">Handling seconds saved per job <output>{seconds}</output><input id="handling-seconds" type="range" min="0" max="180" step="5" value={seconds} onChange={e => setSeconds(Number(e.target.value))} /></label>
      <label htmlFor="working-days">Working days per month <output>{days}</output><input id="working-days" type="range" min="1" max="31" value={days} onChange={e => setDays(Number(e.target.value))} /></label>
    </div>
    <div className={styles.calculatorResult} aria-live="polite" aria-atomic="true"><strong>{hours.toFixed(1)}</strong><span>potential staff hours per month</span><small>{jobs} jobs × {seconds} seconds × {days} days ÷ 3,600. Excludes printing time, setup and assisted orders.</small></div>
  </div>;
}
