import Image from 'next/image';
import Link from 'next/link';
import MarketingShell from '@/components/MarketingShell';
import PricingCards from '@/components/PricingCards';
import TimeSavingsCalculator from '@/components/TimeSavingsCalculator';
import styles from '@/components/marketing.module.css';
import { homeMetadata, productSchema, TRIAL_URL } from '@/lib/marketing';

export const metadata = homeMetadata;

const questions = [
  ['How does the two-day free trial work?', 'Request your trial on WhatsApp. We help set up your shop and check your printer before activation. The trial runs for two days with unlimited print jobs and no credit card required. Paper, ink and any payment-provider charges remain separate.'],
  ['Do I need a new printer or a Wi-Fi printer?', 'Start with a printer already installed on your Windows PC. It must print a Windows test page successfully. USB and network connections depend on your Windows driver; colour and two-sided printing depend on the printer. Check compatibility during your trial.'],
  ['Does the customer need an app or account?', 'No. Customers open the shop’s QR link in their phone browser, upload files and select the available print settings. The Windows agent is installed only on the shop computer.'],
  ['Which files can customers print?', 'The upload screen accepts PDF, JPG, JPEG, PNG, WebP, DOCX, XLSX and PPTX. Office documents need conversion and may fail or change layout. For predictable output, export to PDF and check the page count first.'],
  ['When does an online order enter the print queue?', 'Online checkout uses Cashfree. A successful payment must be confirmed by the payment provider before the job is queued or sent for owner approval. A payment screenshot or a browser success message is not enough.'],
  ['Can I accept cash at the counter?', 'Discuss counter-payment handling during setup. Do not assume a cash payment will automatically release an online order; confirm the workflow available for your shop before using it with customers.'],
  ['Are files deleted immediately after printing?', 'No instant-deletion guarantee is made. Files are temporarily stored to process print jobs. Order-linked files receive a 24-hour expiry, and scheduled cleanup processes expired files afterward. Order and payment records can remain. Read the file-handling page for details.'],
  ['What if printing stops or the internet disconnects?', 'Keep the shop computer and agent online while receiving jobs. Check the queue and physical printer before retrying an interrupted order, because some pages may already have printed. Contact support if the job status is unclear.'],
  ['Is GST charged on the software plans?', 'No GST is charged on the listed software subscription prices. Payment-provider charges, hardware, paper, ink and internet are separate from your subscription.'],
];

export default function LandingPage() {
  return <MarketingShell>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema).replace(/</g, '\\u003c') }} />
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div>
          <p className={styles.pill}>Built for Indian copy shops & cyber cafes</p>
          <h1>Print shop automation.<br /><em>Your printer,</em><br />less busywork.</h1>
          <p className={styles.lead}>ScanItPrintIt is print shop automation software for India. Customers scan your QR, upload documents and pay online. Your Windows PC receives the job, ready for automatic printing or your approval.</p>
          <div className={styles.actions}><a className={styles.button} href={TRIAL_URL} target="_blank" rel="noreferrer">Request a 2-day free trial <span aria-hidden="true">↗</span></a><Link className={styles.buttonSecondary} href="/setup">See the setup guide</Link></div>
          <p className={styles.microcopy}>Opens WhatsApp for assisted setup. Unlimited trial jobs. No credit card.</p>
          <div className={styles.proof}><span>No customer app</span><span>Your own print prices</span><span>₹299/month · no GST charged</span></div>
        </div>
        <figure className={styles.heroFigure}>
          <div className={styles.previewHeader}><strong>Inside your shop dashboard</strong><span>Sample orders</span></div>
          <a href="/screenshots/owner-dashboard.png" target="_blank" rel="noreferrer" aria-label="Open full-size ScanItPrintIt dashboard screenshot with sample orders"><Image className={styles.previewImage} src="/screenshots/owner-dashboard.png" alt="Actual ScanItPrintIt owner dashboard with example orders awaiting payment and approval, printer status and shop pricing" width={1280} height={640} sizes="(max-width: 760px) 100vw, 50vw" priority /></a>
          <div className={styles.previewNotes}><div><strong>One place for each order</strong><p>Settings, payment status and pages together.</p></div><div><strong>You stay in control</strong><p>Review the queue and approve jobs.</p></div></div>
          <figcaption className={styles.caption}>Actual ScanItPrintIt dashboard with illustrative sample orders. Tap to enlarge.</figcaption>
        </figure>
      </div>
    </header>
    <div className={styles.sectionWhite}><section id="how" className={styles.section}>
      <p className={styles.eyebrow}>From phone to print queue</p><div className={styles.sectionHeader}><h2>How QR print<br />ordering works.</h2><p>The customer sends the file and settings together. Your shop handles the printer, paper and final handover.</p></div>
      <ol className={styles.steps}>{[
        ['01','Scan your shop QR','Customers open your shop’s upload page in a phone browser. No app or customer account.'],
        ['02','Upload & choose','They add documents and select B&W or colour, copies and supported sides.'],
        ['03','Confirm payment','Cashfree confirms online payment. Jobs then enter the queue or wait for your approval.'],
        ['04','Print & hand over','The paired Windows agent sends the job to your selected printer. Check the output and hand it over.'],
      ].map(([n,title,body]) => <li key={n}><span className={styles.stepNumber}>{n}</span><h3>{title}</h3><p>{body}</p></li>)}</ol>
      <p className={styles.smallPrint}>Setup and printing time depend on your PC, printer, file and connection. <Link className={styles.textLink} href="/setup">Follow the complete setup guide →</Link></p>
    </section></div>
    <section id="why" className={styles.section}>
      <div className={styles.split}><div><p className={styles.eyebrow}>A clearer counter</p><h2>Keep your printer.<br /><em>Change the routine.</em></h2><p className={styles.lead}>Designed for copy shops, xerox centres and cyber cafes handling documents from customers’ phones.</p></div><div><ul className={styles.checklist}><li>Choose automatic printing or owner approval.</li><li>Set your own B&W and colour prices.</li><li>See orders and their payment status together.</li><li>Pair the agent with a compatible Windows printer.</li></ul><Link className={styles.textLink} href="/compatibility">Check your printer and file formats →</Link></div></div>
      <div className={styles.comparison}><div><h3>The manual routine</h3><ol><li>Find the file in a WhatsApp conversation.</li><li>Ask for copies, colour and printing settings.</li><li>Match the payment with the right document.</li><li>Open the file and prepare the print.</li></ol></div><div><h3>With ScanItPrintIt</h3><ol><li>Customer opens your shop QR link.</li><li>File and settings arrive in one order.</li><li>Verified online payment updates the order.</li><li>The Windows agent handles the print submission.</li></ol></div></div>
      <TimeSavingsCalculator />
    </section>
    <div className={styles.sectionTint}><section className={styles.section}>
      <p className={styles.eyebrow}>Before you install</p><h2>The details that matter<br />at a real print counter.</h2>
      <div className={styles.cards}><article className={styles.card}><h3>Will my printer work?</h3><p>Check the Windows driver, available print settings and a test page before accepting customer jobs.</p><Link href="/compatibility">Read the compatibility checklist →</Link></article><article className={styles.card}><h3>What happens to files?</h3><p>Documents are temporarily stored for processing. Expiry, cleanup and order records are different things.</p><Link href="/privacy">Understand file handling →</Link></article><article className={styles.card}><h3>What if a job fails?</h3><p>Check the printer and order status before retrying. Support can help investigate an interrupted job.</p><Link href="/setup#troubleshooting">Follow the troubleshooting steps →</Link></article></div>
    </section></div>
    <section id="pricing" className={styles.section}><p className={styles.eyebrow}>Software pricing</p><h2>Choose a plan for your shop.</h2><p className={styles.lead}>Start with a two-day free trial. Unlimited trial jobs, no credit card, and no GST charged on the listed software prices.</p><PricingCards /><p className={styles.smallPrint}><Link className={styles.textLink} href="/pricing">See billing, payment and trial details →</Link></p></section>
    <section id="trial" className={styles.trial}><div className={`${styles.section} ${styles.split}`}><div><p className={styles.eyebrow}>Two days. Your own printer.</p><h2>Try it at<br /><em style={{color:'#f9cf86'}}>your counter.</em></h2><p className={styles.lead}>Tell us your shop name, printer model and Windows version. We’ll help you get to your first test print.</p><div className={styles.actions}><a className={styles.buttonLight} href={TRIAL_URL} target="_blank" rel="noreferrer">Request your trial on WhatsApp ↗</a></div><p className={styles.microcopy}>Two-day free trial · Unlimited print jobs · No credit card</p></div><ol className={styles.trialList}><li><strong>Request access.</strong><br />WhatsApp opens with a trial request for you to send.</li><li><strong>Set up together.</strong><br />Confirm compatibility, pair the Windows agent and check your prices.</li><li><strong>Run a test print.</strong><br />Try the workflow before choosing a paid plan. Confirm the trial start and end during activation.</li></ol></div></section>
    <section id="faq" className={styles.section}><p className={styles.eyebrow}>Shop owner questions</p><h2>Before your first print.</h2><div className={styles.faq}>{questions.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div><p className={styles.smallPrint}>Still have a question? <Link className={styles.textLink} href="/contact">Contact Enclope Enterprises →</Link></p></section>
  </MarketingShell>;
}
