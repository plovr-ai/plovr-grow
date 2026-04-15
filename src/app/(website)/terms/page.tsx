import type { Metadata } from "next";
import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import { Prose } from "@/components/website/ui/Prose";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "Review the terms and conditions for using LocalGrow.ai's services, including your rights and responsibilities.",
};

const termsData = [
  {
    title: "1. Definitions",
    content: [
      `1.1. "Affiliate(s)" means, with respect to a party, any person, corporation, partnership or other entity that directly or indirectly controls or is controlled by or is under common control with such party. For purposes of this definition, the term "control" (including, with correlative meaning, the terms "controlled by" or "under common control with") means the actual power, either directly or indirectly through one or more intermediaries, to direct or cause the direction of the management and policies of such entity, whether by the ownership of fifty percent (50%) or more of the voting stock of such entity, or by contract or otherwise.`,
      `1.2. "Customer" means Merchant's customers and/or guests.`,
      `1.3. "Customer Data" means data and information, which may include Personal Information, collected and/or processed by localgrow.ai or its Affiliates via the SaaS, such as when a Customer enters payment information, submits an online order, or requests a digital receipt, and may include without limitation: (i) contact information (such as name, phone number, email address); (ii) information about the transaction; (iii) card information; (iv) Customer purchase history; and (v) location information.`,
      `1.4. "Ending Date" means the last date of the Term.`,
      `1.5. "Feedback" means comments, suggestions, enhancement requests, modifications, error identifications, ideas, feedback, recommendations or other input about the SaaS and Hardware.`,
      `1.6. "Hardware" means any terminal, Android station (POS machine), payment device, printer, cash drawer, tablet, router, card, cable, or other item of physical hardware, as made available for use by localgrow.ai to Merchant or Merchant Personnel in connection with access to and/or use of the SaaS.`,
      `1.7. "Merchant" has the meaning given to it in the Application.`,
      `1.8. "Merchant Personnel" means Merchant's employees, agents and contractors who are authorized or directed to use the Product for and on behalf of Merchant.`,
      `1.9. "Personal Information" means any information relating to an identified or identifiable individual or household. Personal Information may include, but is not limited to, name, address, contact details, unique identifiers, payment card information, biometric identifiers and information, preferences, history and profile data, IP addresses, and location-based information, but excludes aggregated or anonymized information.`,
      `1.10. "Product" means the Hardware and the SaaS provided by localgrow.ai to Merchant.`,
      `1.11. "SaaS" means localgrow.ai's point-of-sale restaurant system, which is a cloud-based software or mobile application made available to Merchant by localgrow.ai, including both online and offline components, products, supported integrations with third parties, services, features, content, and updates related thereto.`,
      `1.12. "Scheme Owners" means the party who regulates and provides a specific payment method (e.g., Visa, MasterCard).`,
      `1.13. "Scheme Rules" means the collective set of bylaws, rules, regulations, operating regulations, procedures and/or waivers issued by the Scheme Owners as may be amended or supplemented over time and with which merchants and payment service providers must comply with when using the relevant payment method.`,
      `1.14. "Starting Date" means the date of signing this Agreement.`,
      `1.15. "Term" means 12 months since the date of signing the Application/Agreement. The date of signing should be the latest date when all signatures are obtained.`,
    ],
  },
  {
    title: "2. Product & Services",
    content: [
      `2.1. SaaS. The SaaS may include, but is not limited to, (a) the provision of mobile and web applications for use by Merchant Personnel and Customer to place orders; (b) facilitation of services provided by, and the introduction to, third party payment processing service providers to Merchant; (c) providing Merchant with information regarding its sales and other business activities; and (d) working with Merchant with respect to any Customer inquiries related to payments made by Merchant to Customers or placing orders, in each case under Merchant's account with localgrow.ai.`,
      `2.2. Hardware. Merchant shall: (a) use and operate the Hardware in accordance with the Hardware operating instructions provided by localgrow.ai; (b) use the Hardware only for the purposes specified under this Agreement; and (c) not transfer, lend, sell or otherwise provide the Hardware in any manner to any third party. In the event of loss, theft, damage or other malfunction of the Hardware, Merchant shall promptly notify localgrow.ai in writing, and allow localgrow.ai access to the store site during business hours upon reasonable notice to inspect, repair, install or replace the Hardware. localgrow.ai is entitled to charge reasonable fees for Hardware repair and replacement.`,
      `2.3. Third-Party Payment Providers. Unless otherwise agreed by the parties in writing, the SaaS includes applicable payment processing functionality provided directly through a third-party payment processor or gateway, which shall initially be Adyen N.V. and may be changed by localgrow.ai at any time in its sole discretion.`,
    ],
  },
  {
    title: "3. License",
    content: [
      `3.1. Subject to Merchant's and Merchant Personnel's continuing compliance with the terms and conditions of this Agreement, localgrow.ai hereby grants to Merchant a limited, non-exclusive, non-transferable, non-sublicensable, revocable license during the Term to access and use the Product solely and exclusively for the purpose of performing the test (the "License"). Merchant acknowledges and agrees that this Agreement shall only provide Merchant with access to and use of the Product for aforementioned purposes only at the store location as specified in the Application. Merchant shall not be entitled to any further use, copy or license of the Product under this Agreement.`,
      `3.2. Merchant acknowledges that the use of cloud-based software or mobile applications may require its acceptance of additional terms and conditions and policies at the time of installation or first operation, and agrees to accept such additional terms and conditions.`,
    ],
  },
  {
    title: "4. Restrictions on Use",
    content: [
      `4.1. Merchant shall not, and shall cause Merchant Personnel not to, directly or indirectly:`,
      `(i) use the Product in any manner that is inconsistent with this Agreement, especially use the Product for purpose other than the test, such as downloading applications or software from localgrow.ai's competitors on the Hardware;`,
      `(ii) license, sublicense, sell, resell, transfer, assign, lease, rent timeshare, distribute or otherwise commercially exploit the Product or make the Product available to any third party, including Merchant's Affiliates;`,
      `(iii) copy, reproduce, modify or make derivative works based upon the Product;`,
      `(iv) reverse engineer, decompile, disassemble or otherwise attempt to discover the source code, object code or underlying structure, ideas or algorithms of the Product;`,
      `(v) use or access the Product to build or support, and/or assist a third party in building or supporting, products or services competitive with the Product;`,
      `(vi) remove or obscure any proprietary notices or labels from the Product;`,
      `(vii) use the Product in violation of applicable laws including, without limitation, money transmission and lending (including licensing and registration laws), privacy and data protection laws;`,
      `(viii) use the Product for misuse, fraud, illegal activities, excessive costs or for explicit activity, such as adult content, arms, drugs, counterfeit goods;`,
      `(ix) use the Product for any fraudulent undertaking or in any manner that could damage, disable, overburden, impair or otherwise negatively affect localgrow.ai's ability to provide the Product (including but not limited to the use of automated systems or software, such as screen scraping, to extract data from the SaaS or other aspects of the Product;`,
      `(x) violate or breach any operating procedures, requirements or guidelines regarding Merchant's use of the Product that are posted on or through the SaaS or otherwise provided or made available to Merchant, including, without limitation, any action or inaction taken contrary to the requirements of PCI-DSS;`,
      `(xi) circumvent or disable any security or other technological features of the Product;`,
      `(xii) disclose or publish, without localgrow.ai's prior written consent, performance or capacity statistics or the results of any benchmark test performed on the Product.`,
    ],
  },
  {
    title: "5. Ownership",
    content: [
      `5.1. As between the parties, localgrow.ai owns all right, title and interest, including all intellectual property rights, in and to Product and any derivatives, updates, upgrades, extensions, improvements, modifications, and enhancements thereto, as well as any new features, functionality, applications, or services, whether developed by or on behalf of localgrow.ai.`,
      `5.2. Merchant hereby irrevocably assigns and, to the extent any such assignment cannot be made at present, will assign and transfer all right, title, interest in and to any Feedback provided to localgrow.ai pursuant to this Agreement, and acknowledges that its assignment and transfer are gratuitous, unsolicited, and without restriction, and that localgrow.ai is under no fiduciary or other obligation to Merchant in respect of such assignment and transfer, and that localgrow.ai is free to use, disclose, reproduce and otherwise exploit any and all Feedback provided to localgrow.ai pursuant to this Agreement.`,
    ],
  },
  {
    title: "6. Data and Privacy",
    content: [
      `6.1. Subject to Clause 6 hereof, Merchant will own all data relating to its Customers and the commercial transactions processed using the SaaS (collectively, the "Merchant Data"). Merchant acknowledges and agrees that localgrow.ai in the course of collecting, storing and using the Merchant Data. Subject to the foregoing, any data collected through the SaaS may be freely used on an aggregated and/or anonymized basis by localgrow.ai for its own business purposes. Merchant may have the ability through the SaaS to edit or delete Merchant Data. Merchant acknowledges and agrees that (i) Merchant is solely responsible for all consequences of any such edit or deletion and will indemnify localgrow.ai for any losses or costs to localgrow.ai that result from any such edit or deletion, (ii) such edits and deletions are intended to be permanent and it may not be possible to recover the Merchant Data as it existed before any edit or deletion, (iii) Merchant is responsible for any edit or change made using Merchant's password, account or other credentials to access the SaaS and will implement appropriate data, cyber and personnel security measures to prevent unauthorized edits or deletions, (iv) Merchant will make edits or deletions of Merchant Data only for a proper purpose and will not make any edit or deletion that violates any applicable law, regulation, court order, contract, litigation hold notice or other obligation to which Merchant is subject (an edit or deletion in violation, a "Data Hold Violation") and (v) localgrow.ai may, in its sole discretion eliminate or suspend Merchant's ability to edit or delete Merchant Data using the SaaS and expects to do so if localgrow.ai concludes that localgrow.ai is or may be required to do so to avoid a Data Hold Violation by localgrow.ai. If Merchant chooses to use our website-building service, Merchant acknowledges and agrees that localgrow.ai may, upon Merchant's authorization, assist in migrating content, materials, and other related data from Merchant's existing website to the newly established website. Merchant hereby grants localgrow.ai the right to use automated technological tools and processes to perform and complete such migration.`,
      `6.2. Each party will comply with all applicable data privacy laws relating to the collection, use, processing, or disclosure of Personal Information. Without prejudice to the foregoing, Merchant shall ensure that any disclosure of Personal Information, whether in relation to Merchant Personnel or otherwise, made to localgrow.ai by Merchant or on its behalf is made with the data subject's consent or is otherwise lawful.`,
      `6.3. Each party is responsible for implementing and maintaining appropriate technical, organizational and administrative security controls to safeguard Personal Information as well as other data associated with its respective obligations under this Agreement. For the avoidance of doubt, this includes access controls and ensuring that Personal Information or other data collected as part of the SaaS is not improperly disclosed. In all cases, this obligation shall not limit Merchant's obligations regarding the implementation of any security measures required under the applicable data protection laws.`,
    ],
  },
  {
    title: "7. Taxes",
    content: [
      `7.1. Each party shall be responsible for its own taxes incurred in connection with the test performed under this Agreement. All such taxes shall be borne by the party incurring them, and each party shall indemnify and hold the other party harmless from any claims, liabilities, or expenses relating to such taxes. If localgrow.ai has the legal obligation to pay or collect taxes for which Merchant is responsible under this Agreement, localgrow.ai will invoice Merchant and Merchant will pay that amount unless Merchant provides localgrow.ai with a valid tax exemption certificate authorized by the appropriate taxing authority. localgrow.ai is solely responsible for taxes assessable against it based on its income, property and employees.`,
    ],
  },
  {
    title: "8. Payment Processing Terms",
    content: [
      `8.1. To facilitate Merchant's settlement with customers within the SaaS environment, localgrow.ai will collaborate with third-party payment processors to integrate the APIs of such processors with the SaaS product. For the provision of these payment network connection services, Merchant agrees to pay localgrow.ai related services fees as indicated in the Application, which are non-refundable after occurrence. In addition to paying the specified rate for processing sales transactions, Merchant will also pay certain per-occurrence fees (i.e. related fees for chargeback, refund and etc.) as they arise. localgrow.ai shall have the right to adjust rates and fees without notice to offset any direct or indirect cost to localgrow.ai in providing services hereunder.`,
      `8.2. Merchant consents that third-party payment processors will receive settlement for processed payment transactions for Merchant and will settle received funds directly to the bank accounts of Merchant. Third-party payment processors will deduct from the Merchant funds the Network Fees owed by Merchant to localgrow.ai and the refunds and chargebacks processed for Merchant.`,
      `8.3. Payment services integrated within the SaaS product shall be provided directly to Merchant by third-party payment processors. Prior to utilizing the services of third-party payment processors, Merchant is required to submit relevant onboarding documentation/information and ensure its veracity, accuracy, and completeness. By signing this Agreement, Merchant is deemed to have entered into an agreement directly with the third-party payment processors for the payment services, currently Adyen and accept the third-party payment processors' terms and restrictions (currently Adyen's terms and restrictions: https://www.adyen.com/legal/terms-and-conditions-adyen-for-platforms, https://www.adyen.com/legal/list-restricted-prohibited-products-and-services, or other terms and conditions displayed on the SaaS product pages by localgrow.ai). If Merchant fails to complete the onboarding process with the third-party payment processors, or does not pass the verification/review of KYC and the third-party payment processors terminate the provision of payment processing services to Merchant, localgrow.ai reserves the right to immediately terminate this Agreement.`,
      `8.4. Merchant may only use the payment services to accept payment for products and services sold by the Merchant itself to customers and only for the type of products and services Merchant described in its onboarding documentation. Merchant shall not utilize the third-party payment processing services for transactions involving any goods or services that contravene any applicable laws or Scheme Rules. Merchant will also not use third-party processing services for misuse, fraud, illegal activities, excessive costs or for explicit activity, such as adult content, arms, drugs, counterfeit goods. By signing this Agreement, Merchant is deemed to have consented to the third-party payment processors' rules on prohibited and restricted products and services (currently Adyen's prohibition list: Prohibited and Restricted products & services - Adyen).`,
      `8.5. Merchant shall bear full responsibility and indemnify localgrow.ai against any claims, fines, penalties, and reasonable legal attorney fees arising from Merchant's non-compliance with applicable laws or Scheme Rules. This includes, without limitation, any fines levied by third-party payment processors, Scheme Owners, or regulatory authorities against localgrow.ai as a consequence of Merchant's non-compliance. A breach of the third-party payment processors' terms and restrictions in Clause 8.3 and 8.4 under this section will be deemed a violation of this Agreement.`,
      `8.6. Merchant shall be solely responsible for and bear all chargebacks, refunds and related fees arising from transactions with customers. Should Merchant fail to properly handle such matters resulting in claims from customers or third-party payment processors against localgrow.ai, localgrow.ai reserves the right to demand full compensation from Merchant and may deduct such amounts from any payments due from localgrow.ai to Merchant (if any).`,
    ],
  },
  {
    title: "9. Confidentiality",
    content: [
      `9.1. Each party undertakes not to, throughout the Term and two years after the termination of this Agreement, directly or indirectly disclose to any person any information it obtained from the other party during the performance of this Agreement ("Confidential Information"), unless`,
      `(i) it is necessary for a party to make disclosure to its employees, agents or advisors ("Relevant Personnel") for exercising or performing its rights or obligations under this Agreement; or`,
      `(ii) the disclosure is required by applicable laws, a court with jurisdiction, or any governmental or regulatory authority.`,
      `9.2. For the avoidance of doubt, Confidential Information includes but is not limited to the Product, any information relating thereto and the terms of this Agreement. Confidential Information does not include any information or materials that are already publicly available, unless such information or materials are publicly available due to a breach of confidentiality obligations in this Clause 9.`,
      `9.3. The parties shall cause their Relevant Personnel to abide by the confidentiality obligations in this Clause 12.`,
      `9.4. Upon the termination of this Agreement, Merchant shall promptly return or destroy all documents or materials embodying localgrow.ai's brand or Confidential Information (in any form or medium and including, without limitation, all summaries, copies and excerpts of Confidential Information) at any such time as localgrow.ai may so request at Merchant's own cost.`,
    ],
  },
  {
    title: "10. Term & Termination",
    content: [
      `10.1. Unless this Agreement is terminated earlier pursuant to this Clause, this Agreement shall become effective from the Starting Date until the Ending Date of the Term.`,
      `10.2. localgrow.ai has right to terminate this Agreement by notifying Merchant in writing under any of the following circumstances:`,
      `(i) Merchant is in breach of Clause 3 to Clause 6, Clause 8 or Clause 9, in which case termination will take effect immediately upon localgrow.ai's delivery of termination notice to Merchant; or`,
      `(ii) localgrow.ai sends a five (5) days' prior notice to Merchant, stating that it intends to terminate the cooperation under this Agreement, in which case termination will take effect on the 5th day after localgrow.ai's delivery of termination notice to localgrow.ai.`,
      `10.3. Merchant may terminate this Agreement by sending a thirty (30) days' prior written notice to localgrow.ai, stating that it intends to terminate the cooperation under this Agreement, in which case termination will take effect on the 30th day after Merchant's delivery of termination notice to localgrow.ai.`,
      `10.4. Either party may terminate this Agreement by sending a written notice to the other party under any of the following circumstances:`,
      `(i) the other party commits a material breach of any of its obligations under this Agreement, and fails to fully remedy such breach within five (5) days after receiving a written notice requiring it to be remedied; or`,
      `(ii) the other party enters into bankruptcy, liquidation, or any similar legal proceedings.`,
      `10.5. This Agreement shall terminate upon the parties' mutual agreement in writing.`,
      `10.6. The termination of this Agreement shall not affect the rights, obligations and legal liabilities of any party accrued prior to the termination of this Agreement.`,
      `10.7. Before expiration of the Term, localgrow.ai will send a new Price Sheet with any updated terms and conditions to Merchant, which will update this Agreement and will automatically renew on a month-to-month basis unless terminated with 30 days' prior written notice. Upon receipt of such new Price Sheet, localgrow.ai and Merchant shall use commercially reasonable efforts to negotiate in good faith. Should Merchant decides not to renew such Agreement based on new Price Sheet, Merchant may send a thirty (30) days' prior written notice to localgrow.ai, in which case termination will take effect on the 30th day after Merchant's delivery of termination notice to localgrow.ai.`,
    ],
  },
  {
    title: "11. Representations & Warranties",
    content: [
      `Merchant represents, warrants and covenants that: (a) it has the authority to enter into this Agreement and to grant the rights granted hereunder, and doing so will not violate any other agreement to which it is a party; (b) it is duly organized, validly existing and in good standing under the laws of the jurisdiction of its origin; (c) it will comply with all applicable retail food, beverage (including alcohol) and other applicable health and safety codes, rules or regulations, as well as any other laws applicable to its business; (d) it has all necessary rights, permissions and consent to share the Merchant Data set forth in Clause 6 (including from the applicable end consumers and third-party food ordering platforms); and (e) Merchant will provide reasonable care for all of the Hardware.`,
    ],
  },
  {
    title: "12. Indemnification",
    content: [
      `Merchant will indemnify and hold localgrow.ai and its directors, employees, officers, contractors and agents (each, a "localgrow.ai Indemnitee") harmless from any and all claims, actions, proceedings, losses, costs, expenses, liabilities, judgments, fines, penalties (whether civil, criminal or other) and damages that any localgrow.ai Indemnitee may incur or become obligated to pay resulting from, arising out of or related to a claim of a third party relating to a) Merchant Personnel, including: (a) any third-party transactions or financing arrangement; (b) any taxes payable hereunder; (c) Merchant's, or any Merchant Personnel' breach or nonperformance of any provision of this Agreement; (d) the fraud, gross negligence or willful misconduct of Merchant or its Affiliates or Merchant Personnel; or (e) any claims against localgrow.ai related to the use by localgrow.ai of any Merchant Data or any of Merchant's intellectual property. localgrow.ai will provide prompt written notice to Merchant of any indemnifiable claim subject to indemnification hereunder. Merchant will assume the defense of the claim through counsel designated by it and reasonably acceptable to localgrow.ai, provided that localgrow.ai may use counsel of its choice at its own expense. Merchant will not settle or compromise any claim or consent to the entry of any judgment without localgrow.ai's prior written consent. localgrow.ai will reasonably cooperate with Merchant in the defense of the claim, at Merchant's expense.`,
    ],
  },
  {
    title: "13. Warranty Disclaimer",
    content: [
      `Merchant acknowledges that the product is provided "as is" solely for the purpose of this agreement, and localgrow.ai does not warrant that the product will operate without error or interruption, to the fullest extent permitted by applicable law. localgrow.ai makes no (and expressly disclaims all) warranties, express, implied or statutory, with respect to the product, including without limitation, any warranty of merchantability, fitness for a particular purpose, noninfringement, title, quality, accuracy, fitness for a particular purpose, or warranties arising from course of performance, dealing, usage or trade, its functionality, or its suitability to merchant's requirements. localgrow.ai makes no claim, representation or warranty of any kind as to the utility of the product for merchant's intended use.`,
    ],
  },
  {
    title: "14. Limitation of Liability",
    content: [
      `In no event will localgrow.ai's total liability arising out of or related to this agreement exceed U.S.$1,000 (one thousand US dollars). In no event will localgrow.ai have liability for any loss of profits or revenue, any loss of use, any interruption of business, any account of profits, any increased costs, any loss of anticipated savings, any loss of opportunity, any loss of goodwill or reputation, any loss or corruption of data, nor for any indirect, special, incidental, exemplary, punitive, or consequential loss or damages, however caused and of whatever kind and on any theory of liability (whether in contract, tort (including negligence), strict liability or otherwise). Merchant agrees that localgrow.ai will not be liable for delays, interruptions, service failures or other problems with use of or access to any part of the product resulting from or inherent in the use of the internet and electronic communications or other systems outside of localgrow.ai's reasonable control.`,
    ],
  },
  {
    title: "15. Miscellaneous",
    content: [
      `15.1. Governing Law. This Agreement will be governed in all respects by the laws of the United States of America and by the laws of the State of Texas without reference to conflict of law principles.`,
      `15.2. Force Majeure. Notwithstanding any other provision of this Agreement, neither party shall be deemed in default or breach of this Agreement or liable for any loss or damages or for any delay or failure in performance (except for the payment of money) due to any cause beyond the reasonable control of, and without fault or negligence by, such party or its officers, directors, employees, agents or contractors.`,
      `15.3. Dispute Resolution. Merchant agrees that, by agreeing to this Agreement, Merchant and localgrow.ai are each waiving the right to a trial by jury or to participate in a class action. Merchant's rights will be determined by a neutral arbitrator, not a judge or jury. Any controversy or claim arising out of or relating to this Agreement, or the breach thereof, shall be decided by a single arbitrator in binding arbitration administered by the American Arbitration Association ("AAA") in accordance with its then-current Commercial Arbitration Rules, and judgment on the award rendered by the arbitrator may be entered in any court having jurisdiction thereof. Each party shall bear its own costs, fees and expenses incurred in connection with the arbitration proceeding, including attorneys' fees and expenses and witness costs and expenses. The arbitrator shall apportion the fees, expenses and compensation of the American Arbitration Association and the arbitrator between the parties in such amount as the arbitrator determines is appropriate. Arbitration shall take place in Dallas, Texas, unless the parties mutually agree to another location. Notwithstanding the foregoing, either party may, without waiving any remedy under this Agreement, seek from any court with jurisdiction, interim or provisional equitable relief necessary to protect such party's rights or property. Any civil action seeking injunctive relief, challenging an arbitration proceeding or award or otherwise related to this Agreement will be instituted and maintained exclusively in the federal or state courts situated in the city of Dallas, Texas.`,
      `15.4. Assignment. Without prior written consent of localgrow.ai, Merchant shall not transfer or assign, or attempt to transfer or assign, any rights or obligations under this Agreement to a third party. localgrow.ai has right to transfer or assign any rights or obligations under this Agreement (i) to its Affiliates, or (ii) upon sale of all or substantially all the equity interests, assets or businesses of localgrow.ai.`,
      `15.5. No Waiver; Severability. Delay or failure to strictly enforce any right or provision in this Agreement shall constitute any waiver of such right or provision unless acknowledged and agreed to by such party in writing. A waiver or failure of either party at any time to require performance by the other party of any provision hereof will not affect the full right to require such performance at any time thereafter.`,
      `15.6. Equitable Relief. A breach by either party of Clauses 3, 4, 5 and 9 of this Agreement may cause irreparable damage and the non-breaching party may not be adequately compensated by monetary damages. In the event of a breach, or threatened breach, of Clauses 3, 4, 5 and 9, the non-breaching party will be entitled to seek equitable relief, without the requirement of having to post a bond or other security. Nothing in this Clause is intended, or will be construed, to limit any party's right to equitable relief or any other remedy for a breach of any provision of this Agreement.`,
      `15.7. Entire Agreement. This Agreement contains the final and entire agreement of the parties and supersedes all previous and contemporaneous verbal or written negotiations, understandings, or agreements regarding this Agreement's subject matter.`,
      `15.8. Independent Contractor. The parties are independent contractors and are engaged in the operation of their own respective businesses, and neither party is to be considered the agent of the other party. Neither party has any authority to enter into any contract or assume any obligation for or on behalf of the other party.`,
      `15.9. Amendment. This Agreement may not be amended except in a writing executed by both Merchant and localgrow.ai hereto.`,
      `15.10. Severability. If any provision or portion thereof of this Agreement is held illegal, invalid or unenforceable by an arbitrator or court of competent jurisdiction, or in conflict with any law of a federal, state, or local government with competent jurisdiction, such provision will be stricken and replaced with a provision designed to carry out the initial intent of the parties. The validity of the remaining portions or provisions hereof will not be affected thereby.`,
      `15.11. Counterparts. This Agreement may be executed in one or more counterparts, each of which when executed and delivered by electronic transmission or mail delivery, will be an original and all of which will constitute one and the same instrument. The parties agree that execution of this Agreement by industry standard electronic signature software shall have the same legal force and effect as the exchange of original signatures, and that in any proceeding arising under or related to this Agreement, each party hereby waives any right to raise any defense or waiver based upon execution of this Agreement by means of such electronic signatures or maintenance of the executed agreement electronically.`,
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <Section>
        <Container size="narrow">
          <div className="mx-auto max-w-[880px]">
            {/* Hero */}
            <div className="mb-16 text-center">
              <h1 className="mb-6 font-[family-name:var(--font-manrope)] text-5xl font-light tracking-tight text-ws-text-heading md:text-6xl">
                Terms & Conditions
              </h1>
              <p className="mx-auto max-w-3xl text-xs uppercase leading-relaxed tracking-widest text-ws-text-muted md:text-sm">
                BY USING LOCALGROW&apos;S SERVICES, YOU TRUST US WITH YOUR
                INFORMATION. PLEASE REVIEW THE FOLLOWING TERMS CAREFULLY TO
                UNDERSTAND YOUR RIGHTS AND RESPONSIBILITIES REGARDING THIS.
              </p>
            </div>

            {/* Highlight Box */}
            <div className="mb-12 rounded-r-lg border-l-4 border-ws-primary-500 bg-ws-bg-warm p-6 md:p-8">
              <p className="text-sm leading-relaxed text-ws-text-body">
                LocalgrowAI Inc. (&quot;Localgrow&quot;, or
                &quot;Localgrow.ai&quot;), with registered address at 8 The
                Green, Ste R, Dover, DE 19901, operates the localgrow.ai
                platform. These terms and conditions are referenced in the
                Agreement, and shall apply to and govern Merchant&apos;s access
                to and use of the Product.
              </p>
            </div>

            {/* Content Body */}
            <Prose className="text-ws-text-body">
              <div className="space-y-12">
                {termsData.map((section, index) => (
                  <section key={index} className="scroll-mt-24">
                    <h2 className="mb-6 text-2xl font-bold text-ws-text-heading">
                      {section.title}
                    </h2>
                    <div className="space-y-4">
                      {section.content.map((paragraph, pIndex) => (
                        <p
                          key={pIndex}
                          className="text-base leading-relaxed text-ws-text-body"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </Prose>
          </div>
        </Container>
      </Section>

      <CTACard />
    </>
  );
}
