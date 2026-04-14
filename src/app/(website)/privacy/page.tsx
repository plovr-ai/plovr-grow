import type { Metadata } from "next";
import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import { Prose } from "@/components/website/ui/Prose";
import { CTACard } from "@/components/website/sections/CTACard";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how LocalGrow.ai collects, uses, and protects your personal information.",
};

function SectionBullet() {
  return (
    <span
      className="inline-block mr-4 h-3.5 w-3.5 flex-shrink-0 rounded-full bg-ws-primary-500"
      aria-hidden="true"
    />
  );
}

export default function PrivacyPage() {
  return (
    <>
      <Section>
        <Container size="narrow">
          <div className="mx-auto max-w-[880px]">
            {/* Hero */}
            <div className="mb-16 text-center">
              <h1 className="mb-6 font-[family-name:var(--font-manrope)] text-5xl font-light tracking-tight text-ws-text-heading md:text-6xl">
                Privacy Policy
              </h1>
              <p className="mx-auto max-w-3xl text-xs uppercase leading-relaxed tracking-widest text-ws-text-muted md:text-sm">
                BY USING LOCALGROW&apos;S SERVICES, YOU TRUST US WITH YOUR
                INFORMATION. PLEASE REVIEW THE DETAILS BELOW ON HOW WE COLLECT,
                USE, AND PROTECT YOUR PERSONAL DATA.
              </p>
            </div>

            {/* Highlight Box */}
            <div className="mb-12 rounded-r-lg border-l-4 border-ws-primary-500 bg-ws-bg-warm p-6 md:p-8">
              <p className="mb-2 text-sm font-medium text-ws-text-heading">
                Last updated: August 27th, 2025
              </p>
              <p className="text-sm leading-relaxed text-ws-text-body">
                See the State law privacy rights section below for important
                information about your rights under applicable state privacy
                laws.
              </p>
            </div>

            {/* Content Body */}
            <Prose className="text-ws-text-body">
              <div className="space-y-12">
                {/* Intro Paragraphs */}
                <div className="space-y-6">
                  <p>
                    <strong>
                      California Notice at Collection/State Law Privacy Rights:
                    </strong>{" "}
                    See the State law privacy rights section below for important
                    information about your rights under applicable state privacy
                    laws.
                  </p>
                  <p>
                    This Privacy Statement describes how LocalGrow.ai Inc.
                    operating under the brand name Localgrow
                    (&quot;Localgrow.ai&quot;, &quot;LocalGrow.ai&quot;,
                    &quot;we&quot;, &quot;us&quot;, and/or &quot;our&quot;)
                    processes personal information that we collect through our
                    digital or online properties or services that link to this
                    this Statement, including our web application, the website,
                    social media pages, marketing activities, live events and
                    other activities described in this Privacy Statement
                    (collectively referred to as &quot;Services&quot;). To
                    transparently outline our procedures regarding your personal
                    information, we have established this Privacy Statement
                    (&quot;this Statement&quot;).
                  </p>
                  <p>
                    This Statement primarily covers the information we collect
                    from or about the following groups of individuals:
                  </p>
                  <ul>
                    <li>
                      <strong>&quot;Merchants&quot;</strong>: businesses that
                      have expressed interest in using the Services or have
                      contracted with LocalGrow to provide the Services within
                      their restaurants;
                    </li>
                    <li>
                      <strong>&quot;Merchant Employees&quot;</strong>: employees
                      of our Merchants that use the Services; and
                    </li>
                    <li>
                      <strong>&quot;Guests&quot;</strong>: individuals that use
                      the Services at one of our Merchant&apos;s restaurants,
                      through a business partner, or directly through LocalGrow.
                    </li>
                  </ul>
                  <p>
                    You can download a printable copy of this Statement by
                    printing this page.
                  </p>
                </div>

                {/* Section 1 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    1. What personal information we collect
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      Information you provide to us. The personal information you
                      may provide to us through the Application, whatever you
                      interact with or contract with the Services.
                    </p>
                    <p>
                      If you are a Merchant using the Services, we may collect:
                    </p>
                    <ul>
                      <li>
                        Contact data, such as your name, billing and mailing
                        address, email, date of birth, professional title and
                        company name, and phone number.
                      </li>
                      <li>
                        Government-issued identification number data, such as
                        your tax identification number or national identification
                        number (e.g. Social Security number or passport number).
                      </li>
                      <li>
                        Financial data, including banking and payment card
                        information.
                      </li>
                      <li>
                        Communications data based on our exchanges with you,
                        including when you contact us through the Services,
                        social media, or otherwise.
                      </li>
                      <li>
                        Marketing data, such as your preferences for receiving
                        our marketing communications and details about your
                        engagement with them.
                      </li>
                      <li>
                        Other data not specifically listed here, which we will
                        use as described in this Privacy Statement or as
                        otherwise disclosed at the time of collection.
                      </li>
                    </ul>
                    <p>
                      If you are a guest using the Services at one of our
                      Merchant&apos;s restaurants, we may collect:
                    </p>
                    <ul>
                      <li>
                        Contact data, such as your name, email, date of birth,
                        and phone number.
                      </li>
                      <li>
                        Payment data needed to facilitate transaction processing.
                        This information is shared with the necessary payment
                        institutions for processing purposes. The data collected
                        may include your payment card information, such as the
                        brand, card number, security code and expiration date,
                        transaction information and details.
                      </li>
                      <li>
                        Communications data based on our exchanges with you,
                        including when you contact us through the Services,
                        social media, or otherwise.
                      </li>
                      <li>
                        Marketing data, such as your preferences for receiving
                        our marketing communications and details about your
                        engagement with them.
                      </li>
                      <li>
                        Account data, such as the phone number, username, or
                        password that you may set to establish an online account
                        with the Services, date of birth, redemption code,
                        loyalty program details and points, dietary or allergy
                        information, reservation or waitlist details, vehicle
                        information (for curbside pickup), preferences, order
                        history, information about your participation in our
                        contests, promotions, or surveys, and any other
                        information that you add to your account profile.
                      </li>
                      <li>
                        Other data not specifically listed here, which we will
                        use as described in this Privacy Statement or as
                        otherwise disclosed at the time of collection.
                      </li>
                    </ul>
                    <p>
                      If you are a Merchant Employee, we may collect:
                    </p>
                    <ul>
                      <li>
                        Contact data, such as your name, billing and mailing
                        address, email, date of birth, and phone number.
                      </li>
                      <li>
                        LocalGrow&apos;s Pay Card and PayOut Service data, such
                        as your account and transaction history.
                      </li>
                    </ul>
                    <p>
                      Information collected automatically. We, our service
                      providers, and our business partners may collect
                      information automatically when you visit our websites,
                      complete a transaction, or use our Services. Information
                      collected automatically may include:
                    </p>
                    <ul>
                      <li>
                        Device data, such as your device type/model, number and
                        device ID (e.g., MAC address), information about your
                        browser, settings (e.g., language) and operating system;
                        your internet protocol (IP) address (including, in some
                        instances, your perceived location); and unique
                        advertising and related identifiers; transactional and
                        purchase information.
                      </li>
                      <li>
                        Online activity data, such as pages or screens you
                        viewed, how long you spent on a page or screen, the
                        website you visited before browsing to the Service,
                        navigation paths between pages or screens, information
                        about your activity on a page or screen, access times
                        and duration of access, and whether you have opened our
                        emails or clicked links within them.
                      </li>
                      <li>
                        Communication interaction data such as your interactions
                        with our email or other communications (e.g., whether
                        you open and/or forward emails) - we may do this through
                        use of pixel tags (which are also known as clear GIFs),
                        which may be embedded invisibly in our emails.
                      </li>
                    </ul>
                    <p>
                      Information collected from other sources. We may also
                      collect personal information about you from identity
                      verification services, credit bureaus (if applicable),
                      banks and other financial institutions and credit card
                      companies.
                    </p>
                  </div>
                </section>

                {/* Section 2 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    2. How we use personal information
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      We may use your personal information for the following
                      purposes or as otherwise described at the time of
                      collection:
                    </p>
                    <ul>
                      <li>
                        Provide, maintain and support our Services. We use your
                        personal information to take and handle orders, deliver
                        products or services, process payments, and enable
                        access to or usage of Services for Merchants and their
                        employees.
                      </li>
                      <li>
                        Operating and managing our business. We use your personal
                        information to take actions performance analysis
                        including assessing actual current and service
                        development, generating analytics for our benefit and
                        that of our Merchants, evaluating service effectiveness,
                        service and website improvement.
                      </li>
                      <li>
                        Provide, troubleshoot, and improve our services. We use
                        your personal information to provide functionality,
                        analyze performance, fix errors, and improve the
                        usability and effectiveness of our services.
                      </li>
                      <li>
                        Comply with legal obligations and protection. In certain
                        cases, we collect and use your personal information to
                        comply with laws, protect our, your or others&apos;
                        rights, privacy, safety or property (including by making
                        and defending legal claims); audit our internal processes
                        for compliance with legal and contractual requirements or
                        our internal policies; enforce the terms and conditions
                        that govern the Services; prevent, identify, investigate
                        and deter fraudulent, harmful, unauthorized, unethical
                        or illegal activity, including cyberattacks and identity
                        theft.
                      </li>
                      <li>
                        Fraud Prevention and Credit Risks. We use personal
                        information to prevent and detect fraud and abuse in
                        order to protect the security of our customers,
                        Localgrow.ai, and others. We may also use scoring
                        methods to assess and manage credit risks.
                      </li>
                      <li>
                        Marketing and advertising. We may use your personal
                        information for marketing purposes.
                      </li>
                      <li>
                        Direct marketing. We may send you direct marketing
                        communications and may personalize these messages based
                        on your needs and interests. You may opt-out of our
                        marketing communications as described in the Opt-out of
                        marketing section below. Upon messaging opt-in, you
                        agree to receive messages regarding our services and
                        updates. You can opt out by replying STOP or request
                        more information by replying HELP. Message frequency
                        varies. Message and data rates may apply.
                      </li>
                      <li>
                        Interest-based advertising. We use cookies and other
                        technologies to collect information about your
                        interaction with the Service, our communications and
                        other online services over time, and use that
                        information to serve online ads that we think will
                        interest you. This is called interest-based advertising.
                      </li>
                      <li>
                        Data use in the context of corporate events. We may use
                        certain personal information in the context of actual or
                        prospective corporate events - for more information, see
                        How we use personal information, below.
                      </li>
                      <li>
                        To create aggregated, de-identified and/or anonymized
                        data. We may create aggregated, de-identified and/or
                        anonymized data from your personal information and other
                        individuals whose personal information we collect. We
                        make personal information into de-identified and/or
                        anonymized data by removing information that makes the
                        data identifiable to you. We may use this aggregated,
                        de-identified and/or anonymized data for our lawful
                        business purposes, including to analyze and improve the
                        Service and promote our business.
                      </li>
                      <li>
                        Further uses. In some cases, we may use your personal
                        information for further uses, in which case we will ask
                        for your consent to use of your personal information for
                        those further purposes if they are not compatible with
                        the initial purpose for which information was collected.
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    3. How we protect and use personal information
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      No mobile information or personally identifiable
                      information (PII) will be shared with third
                      parties/affiliates for marketing/promotional purposes. All
                      the stated categories in this privacy policy exclude text
                      messaging originator opt-in data and consent; this
                      information will not be shared with any third parties. End
                      users can opt out of receiving further messages by replying
                      STOP or ask for more information by replying HELP. Message
                      frequency varies. Message and data rates may apply.
                    </p>
                    <p>
                      We use your personal information only when necessary to
                      operate our Services and in full compliance with applicable
                      privacy requirements:
                    </p>
                    <ul>
                      <li>
                        <strong>Merchants</strong> - We may use your information
                        with the Merchant (and, if applicable, their affiliated
                        group of restaurants) to deliver Services, process
                        transactions, and for operational purposes.
                      </li>
                      <li>
                        <strong>Service Providers</strong>, including SMS
                        messaging providers (e.g., Dialpad), solely to
                        facilitate the delivery of Services like SMS messaging.
                        These service providers only process data on our behalf
                        and under our instructions.
                      </li>
                      <li>
                        <strong>Payment Processors</strong>, to process payments
                        and related transactions. This includes:
                        <ul>
                          <li>
                            Adyen, which may process your payment data in
                            accordance with its own Privacy Policy; and
                          </li>
                          <li>
                            Stripe, which may process your payment data in
                            accordance with its own Privacy Policy.
                          </li>
                        </ul>
                      </li>
                      <li>
                        <strong>Professional Advisors or Authorities</strong>,
                        such as legal counsel, auditors, regulators, or law
                        enforcement officials, only when necessary to:
                        <ul>
                          <li>Enforce our Terms of Service;</li>
                          <li>
                            Investigate or prevent fraud or security issues;
                          </li>
                          <li>
                            Comply with legal obligations or governmental
                            requests.
                          </li>
                        </ul>
                      </li>
                    </ul>
                    <p>
                      <strong>Explicit Non-Sharing Statement:</strong>
                    </p>
                    <p>
                      Phone numbers, SMS consent, and related opt-in information
                      will never be shared with third parties or affiliates under
                      any circumstances.
                    </p>
                    <p>
                      We do not sell, trade, or otherwise transfer personal
                      information—including phone numbers or SMS opt-in data—for
                      marketing or promotional purposes.
                    </p>
                    <p>
                      We do not share personal data with advertising or marketing
                      partners.
                    </p>
                  </div>
                </section>

                {/* Section 4 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    4. How we store your personal information
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      We are an international company and may use service
                      providers that operate in other countries. Your personal
                      information may be transferred to the United States or
                      other locations where privacy laws may not be as protective
                      as those in your state, province, or country. For example,
                      we will store your personal information in the U.S. on AWS
                      which is our cloud service provider.
                    </p>
                  </div>
                </section>

                {/* Section 5 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    5. Cookies and Similar Technology
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      Localgrow.ai may use cookies, web beacons and other
                      tracking technologies as part of providing the Services and
                      for the purposes described in this Statement.
                    </p>
                    <p>
                      There are other tracking technologies, such as web
                      beacons/GIFs, pixels, page tags, embedded scripts, that
                      consist of small transparent image files or other web
                      programming code that record how you interact with
                      websites, mobile applications and services. They are often
                      used in conjunction with web browser cookies or other
                      identifiers associated with your device.
                    </p>
                    <p>
                      You may have the right to accept or reject cookies. You can
                      manage or delete cookies according to your preferences,
                      such as clearing all cookies saved on your computer, mobile
                      device or in the software, but you may not be able to fully
                      experience some of our convenience and security services.
                    </p>
                  </div>
                </section>

                {/* Section 6 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    6. How we protect your personal information
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      We have implemented technical and organizational measures
                      (such as network isolation, data encryption, employee
                      access control and other measures) designed to protect the
                      personal information we process.
                    </p>
                    <p>
                      However, no system or network is absolutely safe, and we
                      cannot guarantee the security of your personal information.
                    </p>
                  </div>
                </section>

                {/* Section 7 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    7. Third-party services
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      We may provide links to other websites and services. These
                      links and integrations are not an endorsement of, or
                      representation that we are affiliated with, any third
                      party. These websites and services may operate
                      independently from us and may have their own privacy
                      notices or policies, which we strongly suggest you review
                      before you use any of their services or conduct any
                      activities on those websites. To the extent that any linked
                      websites you visit are not owned or controlled by us, we
                      are not responsible for their contents, their privacy
                      practices and the quality of their services.
                    </p>
                  </div>
                </section>

                {/* Section 8 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    8. Your rights and choices
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      Depending on the nature of your relationship with
                      Localgrow.ai, we may provide you with the capability to
                      manage your personal information directly as part of the
                      Services or by contacting Localgrow.ai. Users who are
                      located in California or other applicable US states with
                      omnibus consumer privacy laws can find additional
                      information about their rights below.
                    </p>
                    <p>
                      Access or update your information. You can manage your
                      personal information by yourself as logging into your
                      account. In other instances, if applicable, see the
                      choices/options listed as part of the Services or contact
                      us as described in the &quot;How to contact us&quot;
                      section of this Statement. We may need to verify your
                      identity before changing or correcting your information. In
                      certain instances, we may not be able to make the
                      correction or accommodate the request due to legal,
                      contractual or technical restrictions.
                    </p>
                    <p>
                      Opt-out of communications. You may opt-out of
                      marketing-related emails by following the opt-out or
                      unsubscribe instructions at the bottom of the email, or by
                      contacting us. Please note that if you choose to opt-out
                      of marketing-related emails, you may continue to receive
                      service-related and other non-marketing emails.
                    </p>
                    <p>
                      Cookies. Most browsers let you remove or reject cookies. To
                      do this, follow the instructions in your browser settings.
                      Many browsers accept cookies by default until you change
                      your settings. Please note that if you set your browser to
                      disable cookies, the Service may not work properly. For
                      more information about cookies, including how to see what
                      cookies have been set on your browser and how to manage and
                      delete them, visit www.allaboutcookies.org. You can also
                      configure your device to prevent images from loading to
                      prevent web beacons from functioning.
                    </p>
                    <p>
                      Blocking images/clear gifs: Most browsers and devices allow
                      you to configure your device to prevent images from
                      loading. To do this, follow the instructions in your
                      particular browser or device settings.
                    </p>
                    <p>
                      Advertising choices. You may be able to limit use of your
                      information for interest-based advertising through the
                      following settings/options/tools:
                    </p>
                    <ul>
                      <li>
                        Browser settings. Changing your internet web browser
                        settings to block third-party cookies.
                      </li>
                      <li>
                        Privacy browsers/plug-ins. Using privacy browsers and/or
                        ad-blocking browser plug-ins that let you block tracking
                        technologies.
                      </li>
                      <li>
                        Platform settings. Google and Facebook offer opt-out
                        features that let you opt-out of use of your information
                        for interest-based advertising. You may be able to
                        exercise that option at the following websites:
                        <ul>
                          <li>Google: https://adsettings.google.com/</li>
                          <li>Facebook: https://www.facebook.com/about/ads</li>
                        </ul>
                      </li>
                      <li>
                        Ad industry tools. Opting out of interest-based ads from
                        companies that participate in the following industry
                        opt-out programs:
                        <ul>
                          <li>
                            Network Advertising Initiative:
                            http://www.networkadvertising.org/managing/opt_out.asp
                          </li>
                          <li>
                            Digital Advertising Alliance: optout.aboutads.info.
                          </li>
                          <li>
                            AppChoices mobile app, available at
                            https://www.youradchoices.com/appchoices, which will
                            allow you to opt-out of interest-based ads in mobile
                            apps served by participating members of the Digital
                            Advertising Alliance.
                          </li>
                        </ul>
                      </li>
                      <li>
                        Mobile settings. Using your mobile device settings to
                        limit use of the advertising ID associated with your
                        mobile device for interest-based advertising purposes.
                      </li>
                    </ul>
                    <p>
                      You will need to apply these opt-out settings on each
                      device and browser from which you wish to limit the use of
                      your information for interest-based advertising purposes.
                      We cannot offer any assurances as to whether the companies
                      we work with participate in the opt-out programs described
                      above.
                    </p>
                    <p>
                      Do Not Track. Some internet browsers may be configured to
                      send &quot;Do Not Track&quot; signals to the online
                      services that you visit. We currently do not respond to
                      &quot;Do Not Track&quot; signals. To find out more about
                      &quot;Do Not Track,&quot; please visit
                      http://www.allaboutdnt.com.
                    </p>
                    <p>
                      Declining to provide information. We need to collect
                      personal information to provide certain services. If you do
                      not provide the information we identify as required or
                      mandatory, we may not be able to provide those services.
                    </p>
                  </div>
                </section>

                {/* Section 9 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    9. Minors&apos; personal information
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      Our Services are not targeted or directed at the minors
                      under the age of 18, and we do not intend to, or
                      knowingly, collect or solicit personal information from
                      minors. If we learn that any personal information we
                      collected has been provided by a minor, we will promptly
                      delete that personal information. For the collection of
                      personal information of minors with the consent of parents
                      or legal guardians, we will only use or publicly disclose
                      this information if permitted by law, explicitly agreed by
                      parents or guardians or necessary to protect minors.
                    </p>
                  </div>
                </section>

                {/* Section 10 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    10. How to contact us
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      If you have any questions about this Statement or personal
                      information protection, you can reach us via the Customer
                      Service email: contact@localgrow.ai.
                    </p>
                  </div>
                </section>

                {/* Section 11 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    11. Changes to this Privacy Statement
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      From time to time, we may update, change, modify or amend
                      this Privacy Statement in order to comply with the
                      applicable law or our changing business practices. Unless
                      we are required by the applicable law to provide a
                      prescribed form of notice and/or obtain consent, updated
                      versions of this Statement may be posted on this website
                      with additional communication. An archived version of our
                      previous Privacy Statement can be found here. Please check
                      this website and this Privacy Statement regularly for
                      updates.
                    </p>
                  </div>
                </section>

                {/* Section 12 */}
                <section>
                  <h2 className="flex items-center text-xl font-medium text-ws-text-heading">
                    <SectionBullet />
                    12. California notice at collection/US state law privacy
                    notice
                  </h2>
                  <div className="space-y-4 pl-7">
                    <p>
                      Except as otherwise provided, this section only applies to
                      residents of California and other states with privacy laws
                      applicable to us that grant their residents the rights
                      described below. For purposes of this section, &quot;personal
                      information&quot; has the meaning given to &quot;personal
                      data&quot;, &quot;personal information&quot; or similar terms under the
                      applicable privacy laws of the state in which you reside.
                      Please note that not all rights listed below may be
                      afforded to all users and that if you are not a resident of
                      the relevant states, you may not be able to exercise these
                      rights. In addition, we may not be able to process your
                      request if you do not provide us with sufficient detail to
                      allow us to confirm your identity and respond to it.
                    </p>
                    <p>
                      In some cases, we may provide a different privacy notice to
                      certain categories of residents of these states, such as
                      job applicants, in which case that notice will apply with
                      respect to the activities it describes instead of this
                      section.
                    </p>
                    <p>
                      Your privacy rights. You may have some or all of the rights
                      listed below. However, these rights are not absolute, are
                      subject to certain exceptions, and in certain cases we may
                      decline your request as permitted by law.
                    </p>
                    <ul>
                      <li>
                        Right to know. You can request the following information
                        about how we have collected and used your Personal
                        Information during the past 12 months:
                        <ul>
                          <li>
                            The categories of Personal Information that we have
                            collected.
                          </li>
                          <li>
                            The categories of sources from which we collected
                            Personal Information.
                          </li>
                          <li>
                            The business or commercial purpose for collecting
                            Personal Information.
                          </li>
                          <li>
                            The categories of Personal Information that we use
                            for a business purpose.
                          </li>
                        </ul>
                      </li>
                      <li>
                        Right to access/portability. You can request a copy of
                        certain personal information that we have collected about
                        you during the past 12 months.
                      </li>
                      <li>
                        Right to correction. You can request that we correct
                        inaccurate personal information that we have collected
                        about you.
                      </li>
                      <li>
                        Right to deletion. You can request that we delete
                        personal information that we collected from you.
                      </li>
                      <li>
                        Right to opt-out.
                        <ul>
                          <li>
                            Opt-out of profiling/automated decision making. If we
                            use your personal information for profiling/automated
                            decision making as defined by the CCPA or applicable
                            state privacy laws, you can opt-out of such
                            processing.
                          </li>
                        </ul>
                      </li>
                    </ul>
                    <p>
                      Nondiscrimination. You are entitled to exercise the rights
                      described above free from discrimination as prohibited by
                      applicable state privacy laws.
                    </p>
                    <p>
                      How to exercise your rights to know, access/portability,
                      correction, deletion, and opt-out of profiling/automated
                      decision making. You may submit requests to exercise your
                      right to know, access, deletion, correction, and opt-out of
                      profiling/automated decision making to via email to
                      support@localgrow.ai and/or review the information here.
                      The rights described above are not absolute, and in certain
                      cases, we may decline your request as permitted by law. We
                      cannot process your request if you do not provide us with
                      sufficient detail to allow us to understand and respond to
                      it. You may also have the right to appeal any denial of
                      your request in the same manner through which you may
                      submit a request.
                    </p>
                    <p>
                      Exercising your right to opt-out of tracking for targeted
                      advertising purposes. Like many companies, we use services
                      that help deliver interest-based ads to you as described
                      above. You can submit requests to opt-out of tracking for
                      targeted advertising purposes here: Do Not Sell or Share My
                      Personal Information. Your request to opt-out will apply
                      only to the browser and the device from which you submit
                      the request. You can also broadcast the Global Privacy
                      Control (GPC) to opt-out for each participating browser
                      system that you use. Learn more at the Global Privacy
                      Control website.
                    </p>
                    <p>
                      Verification of identity. Authorized agents. We may need to
                      verify your identity to process your requests to exercise
                      your rights to know, access, deletion, and correction, and
                      we reserve the right to confirm your California residency.
                      To verify your identity, we may require you to log into an
                      existing account (if applicable), provide identifiers we
                      can match against information we may have collected from you
                      previously, confirm your request using the email or
                      telephone account stated in the request, provide government
                      identification, or provide a declaration under penalty of
                      perjury, where permitted by law.
                    </p>
                    <p>
                      Your authorized agent may make a request on your behalf
                      upon our verification of the agent&apos;s identity and our
                      receipt of a copy of a valid power of attorney given to
                      your authorized agent pursuant to applicable state law. If
                      you have not provided your agent with such a power of
                      attorney, we may ask you and/or your agent to take
                      additional steps permitted by law to verify that your
                      request is authorized, such as information required to
                      verify your identity and that you have given the authorized
                      agent permission to submit the request.
                    </p>
                    <p>
                      Additional information for California residents: The
                      following describes our practices currently and during the
                      past 12 months:
                    </p>
                    <ul>
                      <li>
                        Sensitive personal information. We do not use or disclose
                        sensitive personal information for purposes that
                        California residents have a right to limit under the
                        CCPA.
                      </li>
                      <li>
                        Sales and Sharing.{" "}
                        <strong>
                          We do not &quot;sell&quot; or &quot;share&quot; personal information as
                          defined by the CCPA and have not sold or shared
                          personal information in the preceding 12 months.
                        </strong>{" "}
                        We do not have actual knowledge that we have sold or
                        shared the personal information of California residents
                        who are under 16 years of age.
                      </li>
                      <li>
                        Retention. The criteria for deciding how long to retain
                        personal information is generally based on whether such
                        period is sufficient to fulfill the purposes for which we
                        collected it as described in this notice, including
                        complying with our legal obligations.
                      </li>
                      <li>
                        Deidentification. We do not attempt to reidentify
                        deidentified information derived from personal
                        information, except for the purpose of testing whether
                        our deidentification processes comply with applicable
                        law.
                      </li>
                      <li>
                        Collection and use. The chart below describes the
                        personal information we collect by reference to the
                        categories of personal information specified in the CCPA
                        (Cal. Civ. Code §1798.140), and how we use it
                        internally. The terms in the chart refer to the
                        categories of information described above in this
                        Statement in more detail. Information you voluntarily
                        provide to us, such as in free-form webforms, may
                        contain other categories of personal information not
                        described below.
                      </li>
                    </ul>
                  </div>

                  {/* CCPA Table */}
                  <div className="not-prose mt-10 overflow-x-auto pl-7">
                    <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-ws-bg-warm">
                          <th className="w-1/4 px-4 py-4 font-medium text-ws-text-heading">
                            PERSONAL INFORMATION (PI) COLLECTED
                          </th>
                          <th className="w-1/4 px-4 py-4 font-medium text-ws-text-heading">
                            CCPA STATUTORY CATEGORY
                          </th>
                          <th className="w-1/4 px-4 py-4 font-medium text-ws-text-heading">
                            CATEGORIES OF THIRD PARTIES (DISCLOSE FOR BUSINESS
                            PURPOSE)
                          </th>
                          <th className="w-1/4 px-4 py-4 font-medium text-ws-text-heading">
                            CATEGORIES OF THIRD PARTIES (SELL OR SHARE)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-ws-bg-subtle text-ws-text-body">
                        <tr>
                          <td className="px-4 py-4 align-top">Contact data</td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (online), Identifiers (other), Commercial
                            information, California customer records
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Advertising
                            Partners, Payment Processors, Business transferees,
                            Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            Government-issued identification number data
                          </td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (online), California customer records
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Business transferees, Professional
                            Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">None</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">Financial data</td>
                          <td className="px-4 py-4 align-top">
                            Commercial information, Financial information,
                            California customer records
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Business transferees, Advertising
                            Partners, Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            Communications data
                          </td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (online), Identifiers (other), Commercial
                            information, California customer records, Internet or
                            Network Information
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Business transferees, Professional
                            Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">Marketing data</td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (online), Identifiers (other), Commercial
                            information, California customer records, Internet or
                            Network Information
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Advertising
                            Partners, Business transferees, Professional Advisors
                            or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">Payment data</td>
                          <td className="px-4 py-4 align-top">
                            Commercial information, Financial information,
                            California customer records
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Business transferees, Professional
                            Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">Account data</td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (online), Identifiers (other), Commercial
                            information, California customer records
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Advertising
                            Partners, Payment Processors, Business transferees,
                            Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            LocalGrow&apos;s Pay Card and PayOut Service data
                          </td>
                          <td className="px-4 py-4 align-top">
                            Commercial information, Financial information,
                            California customer records
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Business transferees, Professional
                            Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">None</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">Device data</td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (other), Internet or Network Information
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Advertising
                            Partners, Payment Processors, Business transferees,
                            Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            Online activity data
                          </td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (other), Commercial information, Internet
                            or Network Information
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Advertising Partners, Business
                            transferees, Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            Communication interaction data
                          </td>
                          <td className="px-4 py-4 align-top">
                            Identifiers (online), Identifiers (other), Commercial
                            information, California customer records, Internet or
                            Network Information
                          </td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Advertising Partners, Business
                            transferees, Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            Data derived from the above
                          </td>
                          <td className="px-4 py-4 align-top">Inferences</td>
                          <td className="px-4 py-4 align-top">
                            Merchants, Business Partners, Third-party Integration
                            Partners, Affiliates, Service Providers, Payment
                            Processors, Advertising Partners, Business
                            transferees, Professional Advisors or Authorities
                          </td>
                          <td className="px-4 py-4 align-top">
                            Advertising partners (to facilitate online
                            advertising)
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-4 align-top">
                            Other Sensitive Personal Information
                          </td>
                          <td className="px-4 py-4 align-top">
                            Protected Classification Characteristics
                          </td>
                          <td className="px-4 py-4 align-top">N/A</td>
                          <td className="px-4 py-4 align-top">N/A</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </Prose>
          </div>
        </Container>
      </Section>

      <CTACard />
    </>
  );
}
