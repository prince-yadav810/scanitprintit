import styles from './marketing.module.css';

export default function PricingCards() {
  return <>
    <div className={styles.pricingGrid}>
      {[
        { name: 'Monthly', price: '₹299', period: 'per month', note: 'Start one month at a time.', features: ['Unlimited print jobs', '1 printer / 1 Windows PC', 'QR ordering & owner dashboard', 'Email support'] },
        { name: 'Annual', price: '₹2,000', period: 'paid once per year', note: 'Save ₹1,588 compared with 12 monthly payments.', features: ['Everything in Monthly', 'Priority support', 'Dedicated setup call', 'About ₹167 per month'], featured: true },
        { name: 'Lifetime', price: '₹5,000', period: 'one-time software payment', note: 'For shops choosing long-term access.', features: ['Everything in Annual', 'Lifetime software updates', 'VIP onboarding call', 'No recurring software subscription'] },
      ].map(plan => <article key={plan.name} className={`${styles.priceCard} ${plan.featured ? styles.featured : ''}`}>
        <p className={styles.eyebrow}>{plan.name}</p><p className={styles.price}>{plan.price}</p><p>{plan.period}</p><p className={styles.planNote}>{plan.note}</p>
        <ul className={styles.checklist}>{plan.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
        <a className={plan.featured ? styles.buttonLight : styles.buttonSecondary} href={`https://wa.me/918591442334?text=${encodeURIComponent(`Hi, I am interested in the ${plan.name} plan (${plan.price}, ${plan.period}) for ScanItPrintIt. Please help me start a 2-day free trial.`)}`} target="_blank" rel="noreferrer">Ask about {plan.name.toLowerCase()} <span aria-hidden="true">↗</span></a>
      </article>)}
    </div>
    <p className={styles.smallPrint}>No GST charged. Software subscription only. Paper, ink, hardware, internet and payment-provider charges are separate. Confirm the final invoice and cancellation terms before activation.</p>
  </>;
}
