import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { normalizePhone } from '../lib/phone.js';

const prisma = new PrismaClient();
const APS_COMPANY = 'co-aps';
const DEMO_PASSWORD = 'demo';

async function ensureTeamLeadDemo() {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const lead = await prisma.user.upsert({
    where: { email: 'lamin@apswallet.gm' },
    create: {
      id: 'usr-lead',
      name: 'Lamin Ceesay',
      email: 'lamin@apswallet.gm',
      passwordHash: hash,
      role: 'team_lead',
      companyId: APS_COMPANY,
      scope: 'Regional oversight',
      zone: 'West Coast Region',
      status: 'active'
    },
    update: {
      role: 'team_lead',
      status: 'active'
    }
  });

  const adrIds = ['usr-adr', 'usr-adr2'];
  await prisma.leadAdrAssignment.deleteMany({ where: { leadId: lead.id } });
  if (adrIds.length > 0) {
    await prisma.leadAdrAssignment.createMany({
      data: adrIds.map((adrId) => ({
        id: `la-${lead.id}-${adrId}`,
        leadId: lead.id,
        adrId,
        companyId: APS_COMPANY
      })),
      skipDuplicates: true
    });
  }
}

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    await ensureTeamLeadDemo();
    console.log('Database already seeded — demo team lead ensured');
    return;
  }

  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  const registeredAt = new Date();

  await prisma.company.createMany({
    data: [
      {
        id: 'co-aps',
        name: 'APS WALLET Gambia',
        plan: 'Enterprise',
        agents: 312,
        officers: 14,
        status: 'active',
        mrr: 2400,
        since: 'Jan 2024',
        contactEmail: 'adama@apswallet.gm',
        registeredAt
      },
      {
        id: 'co-river',
        name: 'River Pay',
        plan: 'Growth',
        agents: 96,
        officers: 5,
        status: 'active',
        mrr: 850,
        since: 'Sep 2024',
        contactEmail: 'ops@riverpay.gm',
        registeredAt
      },
      {
        id: 'co-kombo',
        name: 'Kombo Mobile Money',
        plan: 'Starter',
        agents: 64,
        officers: 4,
        status: 'active',
        mrr: 0,
        since: 'May 2026',
        contactEmail: 'hello@kombomobile.gm',
        registeredAt
      },
      {
        id: 'co-senegal',
        name: 'Téranga Wallet',
        plan: 'Starter',
        agents: 28,
        officers: 2,
        status: 'suspended',
        mrr: 0,
        since: 'Mar 2025',
        contactEmail: 'admin@teranga.sn',
        registeredAt
      }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        id: 'usr-owner',
        name: 'Sulayman Bah',
        email: 'owner@anms.platform',
        passwordHash: hash,
        role: 'system_owner',
        scope: 'All companies',
        status: 'active'
      },
      {
        id: 'usr-platform',
        name: 'Aminata Sarr',
        email: 'support@anms.platform',
        passwordHash: hash,
        role: 'platform_staff',
        scope: 'Platform support',
        status: 'active'
      },
      {
        id: 'usr-mgr',
        name: 'Adama Manneh',
        email: 'adama@apswallet.gm',
        passwordHash: hash,
        role: 'manager',
        companyId: APS_COMPANY,
        scope: 'Full network',
        zone: 'Full network',
        status: 'active'
      },
      {
        id: 'usr-int',
        name: 'Fatoumata Drammeh',
        email: 'compliance@apswallet.gm',
        passwordHash: hash,
        role: 'internal',
        companyId: APS_COMPANY,
        scope: 'Compliance & finance',
        zone: 'Compliance',
        status: 'active'
      },
      {
        id: 'usr-adr',
        name: 'Ebrima Sanneh',
        email: 'ebrima@apswallet.gm',
        passwordHash: hash,
        role: 'adr',
        companyId: APS_COMPANY,
        scope: 'Serrekunda / Banjul',
        zone: 'Serrekunda / Banjul',
        status: 'active'
      },
      {
        id: 'usr-lead',
        name: 'Lamin Ceesay',
        email: 'lamin@apswallet.gm',
        passwordHash: hash,
        role: 'team_lead',
        companyId: APS_COMPANY,
        scope: 'Regional oversight',
        zone: 'West Coast Region',
        status: 'active'
      },
      {
        id: 'usr-agent',
        name: 'Fatou Jallow',
        email: 'fatou.agent@apswallet.gm',
        passwordHash: hash,
        role: 'agent',
        companyId: APS_COMPANY,
        scope: 'APW-0041',
        status: 'active'
      },
      {
        id: 'usr-teller',
        name: 'Omar Touray',
        email: 'omar.teller@apswallet.gm',
        passwordHash: hash,
        role: 'teller',
        companyId: APS_COMPANY,
        scope: 'Teller · APW-0041',
        status: 'active'
      },
      {
        id: 'usr-adr2',
        name: 'Mustapha Keita',
        email: 'mustapha@apswallet.gm',
        passwordHash: hash,
        role: 'adr',
        companyId: APS_COMPANY,
        scope: 'Brikama / Bakau',
        zone: 'Brikama / Bakau',
        status: 'active'
      },
      {
        id: 'usr-adr3',
        name: 'Isatou Bojang',
        email: 'isatou@apswallet.gm',
        passwordHash: hash,
        role: 'adr',
        companyId: APS_COMPANY,
        scope: 'Churchill / Kanifing',
        zone: 'Churchill / Kanifing',
        status: 'active'
      },
      {
        id: 'usr-adr4',
        name: 'Awa Njie',
        email: 'awa@apswallet.gm',
        passwordHash: hash,
        role: 'adr',
        companyId: APS_COMPANY,
        scope: 'Bakau / Kanifing',
        zone: 'Bakau / Kanifing',
        status: 'invited'
      },
      {
        id: 'usr-int2',
        name: 'Lamin Jarju',
        email: 'finance@apswallet.gm',
        passwordHash: hash,
        role: 'internal',
        companyId: APS_COMPANY,
        scope: 'Finance',
        zone: 'Finance',
        status: 'active'
      }
    ]
  });

  await prisma.zone.createMany({
    data: [
      'Greater Banjul',
      'Serrekunda',
      'Brikama',
      'Kanifing',
      'Bakau',
      'Basse',
      'Farafenni'
    ].map((name) => ({ name }))
  });

  const agents = [
    {
      id: 'APW-0041',
      name: 'Fatou Jallow',
      zone: 'Serrekunda',
      phone: '+220 200 0181',
      status: 'active',
      efloat: 85000,
      cash: 12000,
      score: 94,
      visits: 8,
      officer: 'Ebrima Sanneh',
      joined: 'Mar 2024',
      lat: 13.438,
      lng: -16.679,
      kyc: 'verified',
      lastVisit: '2 days ago'
    },
    {
      id: 'APW-0089',
      name: 'Ousman Ceesay',
      zone: 'Brikama',
      phone: '+220 204 2823',
      status: 'active',
      efloat: 72500,
      cash: 8400,
      score: 87,
      visits: 6,
      officer: 'Mustapha Keita',
      joined: 'Jan 2024',
      lat: 13.271,
      lng: -16.65,
      kyc: 'verified',
      lastVisit: '1 day ago'
    },
    {
      id: 'APW-0113',
      name: 'Aminata Touray',
      zone: 'Bakau',
      phone: '+220 201 5645',
      status: 'active',
      efloat: 61000,
      cash: 9200,
      score: 82,
      visits: 7,
      officer: 'Mustapha Keita',
      joined: 'May 2024',
      lat: 13.474,
      lng: -16.72,
      kyc: 'verified',
      lastVisit: 'Today'
    },
    {
      id: 'APW-0176',
      name: 'Lamin Darboe',
      zone: 'Kanifing',
      phone: '+220 207 0258',
      status: 'low_float',
      efloat: 8200,
      cash: 1100,
      score: 61,
      visits: 2,
      officer: 'Ebrima Sanneh',
      joined: 'Aug 2024',
      lat: 13.448,
      lng: -16.656,
      kyc: 'verified',
      lastVisit: '14 days ago'
    },
    {
      id: 'APW-0203',
      name: 'Mariama Fatty',
      zone: 'Churchill',
      phone: '+220 210 0055',
      status: 'critical',
      efloat: 2100,
      cash: 400,
      score: 38,
      visits: 1,
      officer: 'Isatou Bojang',
      joined: 'Oct 2024',
      lat: 13.458,
      lng: -16.644,
      kyc: 'expired',
      kycReviewNote: 'Business permit expired; please upload a current copy.',
      lastVisit: '21 days ago'
    },
    {
      id: 'APW-0058',
      name: 'Binta Sowe',
      zone: 'Greater Banjul',
      phone: '+220 200 0606',
      status: 'active',
      efloat: 54000,
      cash: 7800,
      score: 79,
      visits: 5,
      officer: 'Ebrima Sanneh',
      joined: 'Feb 2024',
      lat: 13.453,
      lng: -16.578,
      kyc: 'verified',
      lastVisit: '3 days ago'
    },
    {
      id: 'APW-0134',
      name: 'Ebrima Colley',
      zone: 'Serrekunda',
      phone: '+220 206 3642',
      status: 'active',
      efloat: 43500,
      cash: 6200,
      score: 88,
      visits: 9,
      officer: 'Isatou Bojang',
      joined: 'Apr 2024',
      lat: 13.441,
      lng: -16.685,
      kyc: 'verified',
      lastVisit: 'Today'
    },
    {
      id: 'APW-0221',
      name: 'Haddy Sanyang',
      zone: 'Brikama',
      phone: '+220 210 0058',
      status: 'suspended',
      efloat: 0,
      cash: 0,
      score: 22,
      visits: 0,
      officer: 'Mustapha Keita',
      joined: 'Sep 2024',
      lat: 13.268,
      lng: -16.66,
      kyc: 'pending',
      lastVisit: '45 days ago'
    },
    {
      id: 'APW-0067',
      name: 'Modou Njie',
      zone: 'Bakau',
      phone: '+220 202 8458',
      status: 'active',
      efloat: 38000,
      cash: 5500,
      score: 91,
      visits: 11,
      officer: 'Awa Njie',
      joined: 'Nov 2023',
      lat: 13.476,
      lng: -16.715,
      kyc: 'verified',
      lastVisit: 'Today'
    },
    {
      id: 'APW-0189',
      name: 'Isatou Drammeh',
      zone: 'Kanifing',
      phone: '+220 210 0049',
      status: 'low_float',
      efloat: 6500,
      cash: 800,
      score: 55,
      visits: 3,
      officer: 'Awa Njie',
      joined: 'Jul 2024',
      lat: 13.445,
      lng: -16.662,
      kyc: 'verified',
      lastVisit: '8 days ago'
    },
    {
      id: 'APW-0245',
      name: 'Sering Gaye',
      zone: 'Greater Banjul',
      phone: '+220 211 6258',
      status: 'active',
      efloat: 67000,
      cash: 11000,
      score: 85,
      visits: 7,
      officer: 'Ebrima Sanneh',
      joined: 'Jun 2024',
      lat: 13.46,
      lng: -16.58,
      kyc: 'verified',
      lastVisit: 'Yesterday'
    },
    {
      id: 'APW-0312',
      name: 'Nyima Ceesay',
      zone: 'Farafenni',
      phone: '+220 212 3222',
      status: 'active',
      efloat: 29000,
      cash: 4200,
      score: 73,
      visits: 4,
      officer: 'Mustapha Keita',
      joined: 'Dec 2024',
      lat: 13.571,
      lng: -15.6,
      kyc: 'pending',
      lastVisit: '5 days ago'
    }
  ];

  await prisma.agent.createMany({
    data: agents.map((a) => ({
      ...a,
      companyId: APS_COMPANY,
      phoneNormalized: normalizePhone(a.phone)
    }))
  });

  const kycDocTypes = ['nationalId', 'businessPermit', 'agentAgreement'];
  const pendingReviewAgents = ['APW-0221', 'APW-0312'];
  await prisma.kycDocument.createMany({
    data: pendingReviewAgents.flatMap((agentId) =>
      kycDocTypes.map((docType) => ({
        agentId,
        docType,
        fileName: `${agentId}-${docType}.pdf`,
        filePath: `kyc/seed/${agentId}-${docType}.pdf`,
        mimeType: 'application/pdf'
      }))
    )
  });

  await prisma.officer.createMany({
    data: [
      {
        companyId: APS_COMPANY,
        name: 'Ebrima Sanneh',
        agents: 82,
        visits: 22,
        target: 25,
        score: 88,
        zone: 'Serrekunda / Banjul'
      },
      {
        companyId: APS_COMPANY,
        name: 'Mustapha Keita',
        agents: 94,
        visits: 24,
        target: 25,
        score: 96,
        zone: 'Brikama / Bakau'
      },
      {
        companyId: APS_COMPANY,
        name: 'Isatou Bojang',
        agents: 78,
        visits: 17,
        target: 25,
        score: 68,
        zone: 'Churchill / Kanifing'
      },
      {
        companyId: APS_COMPANY,
        name: 'Awa Njie',
        agents: 58,
        visits: 11,
        target: 25,
        score: 44,
        zone: 'Bakau / Kanifing'
      }
    ]
  });

  const today = new Date().toISOString().slice(0, 10);

  await prisma.visit.createMany({
    data: [
      {
        companyId: APS_COMPANY,
        agentId: 'APW-0041',
        agentName: 'Fatou Jallow',
        officer: 'Ebrima Sanneh',
        status: 'done',
        time: '09:14',
        type: 'Float check',
        zone: 'Serrekunda',
        visitDate: today
      },
      {
        companyId: APS_COMPANY,
        agentId: 'APW-0089',
        agentName: 'Ousman Ceesay',
        officer: 'Mustapha Keita',
        status: 'done',
        time: '10:32',
        type: 'Branding audit',
        zone: 'Brikama',
        visitDate: today
      },
      {
        companyId: APS_COMPANY,
        agentId: 'APW-0134',
        agentName: 'Ebrima Colley',
        officer: 'Isatou Bojang',
        status: 'done',
        time: '11:45',
        type: 'KYC renewal',
        zone: 'Serrekunda',
        visitDate: today
      },
      {
        companyId: APS_COMPANY,
        agentId: 'APW-0067',
        agentName: 'Modou Njie',
        officer: 'Awa Njie',
        status: 'done',
        time: '13:20',
        type: 'Float check',
        zone: 'Bakau',
        visitDate: today
      },
      {
        companyId: APS_COMPANY,
        agentId: 'APW-0176',
        agentName: 'Lamin Darboe',
        officer: 'Ebrima Sanneh',
        status: 'pending',
        time: '15:00',
        type: 'Float check',
        zone: 'Kanifing',
        visitDate: today
      },
      {
        companyId: APS_COMPANY,
        agentId: 'APW-0203',
        agentName: 'Mariama Fatty',
        officer: 'Isatou Bojang',
        status: 'missed',
        time: '14:00',
        type: 'Float check',
        zone: 'Churchill',
        visitDate: today
      }
    ]
  });

  await prisma.alert.createMany({
    data: [
      {
        companyId: APS_COMPANY,
        type: 'critical',
        title: 'Critical low float',
        body: 'Mariama Fatty — D 2,100 remaining',
        time: '2m ago',
        agentId: 'APW-0203'
      },
      {
        companyId: APS_COMPANY,
        type: 'critical',
        title: 'Agent offline 48h+',
        body: '3 agents in Basse zone unreachable',
        time: '1h ago'
      },
      {
        companyId: APS_COMPANY,
        type: 'warning',
        title: 'Missed visits',
        body: 'Lamin Darboe — 14 days without visit',
        time: '3h ago',
        agentId: 'APW-0176'
      },
      {
        companyId: APS_COMPANY,
        type: 'warning',
        title: 'KYC documents expired',
        body: '4 agents require national ID renewal',
        time: 'Today'
      },
      {
        companyId: APS_COMPANY,
        type: 'warning',
        title: 'Low float approaching',
        body: 'Isatou Drammeh — D 6,500 remaining',
        time: 'Today',
        agentId: 'APW-0189'
      }
    ]
  });

  await prisma.trainingModule.createMany({
    data: [
      {
        companyId: APS_COMPANY,
        title: 'APS WALLET Product Basics',
        assigned: 312,
        completed: 289,
        passing: 271
      },
      {
        companyId: APS_COMPANY,
        title: 'KYC & Compliance Procedures',
        assigned: 312,
        completed: 241,
        passing: 198
      },
      {
        companyId: APS_COMPANY,
        title: 'Float Management Best Practice',
        assigned: 312,
        completed: 204,
        passing: 187
      },
      {
        companyId: APS_COMPANY,
        title: 'Customer Service Standards',
        assigned: 312,
        completed: 178,
        passing: 155
      },
      {
        companyId: APS_COMPANY,
        title: 'Digital Security Awareness',
        assigned: 312,
        completed: 134,
        passing: 112
      }
    ]
  });

  await prisma.floatTrendPoint.createMany({
    data: [
      { companyId: APS_COMPANY, dayIndex: 0, label: 'Mon', efloat: 4100, cash: 980 },
      { companyId: APS_COMPANY, dayIndex: 1, label: 'Tue', efloat: 4350, cash: 1050 },
      { companyId: APS_COMPANY, dayIndex: 2, label: 'Wed', efloat: 4200, cash: 890 },
      { companyId: APS_COMPANY, dayIndex: 3, label: 'Thu', efloat: 4600, cash: 1200 },
      { companyId: APS_COMPANY, dayIndex: 4, label: 'Fri', efloat: 4400, cash: 1100 },
      { companyId: APS_COMPANY, dayIndex: 5, label: 'Sat', efloat: 4150, cash: 950 },
      { companyId: APS_COMPANY, dayIndex: 6, label: 'Sun', efloat: 4200, cash: 870 }
    ]
  });

  await prisma.companySettings.create({
    data: { companyId: APS_COMPANY }
  });

  await ensureTeamLeadDemo();

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
