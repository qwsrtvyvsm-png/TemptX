export const membershipData = {
    heading: "TemptX Membership",
    subheading:
      "More than a listing. Access a high-end network built to position, protect and elevate your presence.",
  
    intro: {
      title: "Your presence, activated.",
      text: "Membership gives you access to the TemptX network. Campaign Credit gives you the ability to activate visibility when it matters most."
    },
  
    tiers: [
      {
        id: "network",
        name: "Network",
        price: "$39",
        interval: "/ month",
        tagline: "Your entry into the TemptX network.",
        featured: false,
        features: [
          "Verified TemptX profile",
          "One active city placement",
          "Standard search visibility",
          "Core profile and contact tools",
          "Access to TemptX opportunities",
          "Network resources and support",
          "10 Campaign Credit each month"
        ],
        button: "Join Network"
      },
      {
        id: "select",
        name: "Select",
        price: "$79",
        interval: "/ month",
        tagline: "For members building a stronger presence.",
        featured: true,
        badge: "Most Popular",
        features: [
          "Everything in Network",
          "Up to three active city placements",
          "Touring and availability tools",
          "Enhanced profile presentation",
          "Expanded media allowance",
          "Profile performance insights",
          "Priority visibility eligibility",
          "30 Campaign Credit each month"
        ],
        button: "Join Select"
      },
      {
        id: "icon",
        name: "Icon",
        price: "$149",
        interval: "/ month",
        tagline: "For members operating at the highest level.",
        featured: false,
        features: [
          "Everything in Select",
          "Premium profile treatment",
          "Priority campaign eligibility",
          "Advanced presence insights",
          "Concierge-style member support",
          "Access to selected collaborations",
          "Editorial and feature consideration",
          "75 Campaign Credit each month"
        ],
        button: "Apply for Icon"
      }
    ],
  
    campaignCredit: {
      title: "Campaign Credit",
      subtitle: "Activate your visibility on your terms.",
      text: "Campaign Credit is TemptX’s internal visibility currency. Use it to launch, refresh, announce or elevate your presence across the network.",
      packs: [
        {
          id: "credit-15",
          amount: 15,
          price: "$15",
          label: "Starter"
        },
        {
          id: "credit-50",
          amount: 50,
          price: "$45",
          label: "Momentum",
          featured: true
        },
        {
          id: "credit-120",
          amount: 120,
          price: "$95",
          label: "Campaign Reserve"
        }
      ]
    },
  
    campaigns: [
      {
        id: "arrival",
        name: "The Arrival",
        creditCost: 25,
        duration: "48 hours",
        description:
          "Announce a new city, touring dates or a fresh return to the network.",
        includes: [
          "Priority city placement",
          "Touring visibility",
          "Profile campaign label"
        ]
      },
      {
        id: "feature",
        name: "The Feature",
        creditCost: 45,
        duration: "7 days",
        description:
          "Put your profile in front of the right audience through elevated platform placement.",
        includes: [
          "Homepage feature rotation",
          "Enhanced category visibility",
          "Featured profile styling"
        ]
      },
      {
        id: "weekend-edit",
        name: "The Weekend Edit",
        creditCost: 30,
        duration: "Friday to Sunday",
        description:
          "Build stronger visibility during high-intent weekend traffic.",
        includes: [
          "Weekend city placement",
          "Priority search visibility",
          "Weekend campaign tag"
        ]
      },
      {
        id: "relaunch",
        name: "The Relaunch",
        creditCost: 60,
        duration: "7 days",
        description:
          "For a new era, new visual direction or a refreshed profile presence.",
        includes: [
          "Homepage feature rotation",
          "Profile refresh placement",
          "Enhanced search positioning",
          "Relaunch campaign label"
        ]
      },
      {
        id: "city-claim",
        name: "The City Claim",
        creditCost: 50,
        duration: "7 days",
        description:
          "Lead visibility within your chosen city and category.",
        includes: [
          "Priority city/category placement",
          "High-visibility profile card",
          "City Claim campaign label"
        ]
      },
      {
        id: "after-dark",
        name: "After Dark Placement",
        creditCost: 20,
        duration: "24 hours",
        description:
          "A short, high-impact visibility activation during peak evening hours.",
        includes: [
          "Evening placement boost",
          "Priority category visibility",
          "After Dark campaign label"
        ]
      }
    ],
  
    selectList: {
      title: "The TemptX Select List",
      subtitle: "Curated. Not simply purchased.",
      text: "The Select List is reserved for members who demonstrate quality, professionalism, strong presentation and alignment with TemptX standards. Selection may be invitation-based, application-based or editorially curated.",
      button: "Learn About Selection"
    },
  
    howItWorks: [
      {
        number: "01",
        title: "Join the network",
        text: "Choose the membership level that suits your current stage."
      },
      {
        number: "02",
        title: "Build your presence",
        text: "Create a profile that reflects your work, standards and direction."
      },
      {
        number: "03",
        title: "Activate when it matters",
        text: "Use Campaign Credit for launches, touring, weekends, features and relaunches."
      },
      {
        number: "04",
        title: "Grow within the network",
        text: "Access greater visibility, opportunities and recognition as your presence develops."
      }
    ],
  
    faq: [
      {
        question: "What is included with membership?",
        answer:
          "Membership gives you an active TemptX profile, network access, visibility eligibility and monthly Campaign Credit depending on your tier."
      },
      {
        question: "What is Campaign Credit?",
        answer:
          "Campaign Credit is used for optional visibility activations such as features, touring announcements, city placements and profile relaunches."
      },
      {
        question: "Do I need Campaign Credit to stay listed?",
        answer:
          "No. Your membership keeps your profile active. Campaign Credit is optional and is designed for members who want to activate additional visibility."
      },
      {
        question: "Can anyone join the TemptX Select List?",
        answer:
          "The Select List is curated. Members may be invited, apply, or be considered through profile quality, professionalism and alignment with TemptX standards."
      },
      {
        question: "Can I cancel my membership?",
        answer:
          "Yes. You can manage or cancel your membership through your account settings. Your access remains active until the end of your current billing period."
      }
    ],
  
    closing: {
      title: "Not just somewhere to be listed.",
      text: "TemptX is a high-end network for people building real presence in the industry.",
      button: "Explore Membership"
    }
  }