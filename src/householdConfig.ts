export type HouseholdId = 'parents' | 'sister' | 'brother' | 'home';

export type HouseholdMember = {
  readonly id: string;
  readonly displayName: string;
  readonly acceptedNames: readonly string[];
};

export type NaverBandLinkSlot = {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly label: string;
  readonly href: `https://band.us/${string}`;
  readonly status: 'active';
};

type SevenNaverBandLinkSlots = readonly [
  NaverBandLinkSlot,
  NaverBandLinkSlot,
  NaverBandLinkSlot,
  NaverBandLinkSlot,
  NaverBandLinkSlot,
  NaverBandLinkSlot,
  NaverBandLinkSlot,
];

export type Household = {
  readonly id: HouseholdId;
  readonly label: string;
  readonly locationLabel: string;
  readonly acceptedNames: readonly string[];
  readonly linkSlotIds: readonly string[];
};

export type HouseholdConfig = {
  readonly id: 'korea-family-map-zoom-household';
  readonly locale: 'ko-KR';
  readonly households: readonly Household[];
  readonly naverBandLinkSlots: SevenNaverBandLinkSlots;
};

export const householdConfig = {
  id: 'korea-family-map-zoom-household',
  locale: 'ko-KR',
  households: [
    {
      id: 'parents',
      label: '한가네 본가',
      locationLabel: '부산광역시 해운대구',
      acceptedNames: ['한봉수', '이은주'],
      linkSlotIds: ['parents-band-1', 'parents-band-2'],
    },
    {
      id: 'sister',
      label: '건희민하찬희네',
      locationLabel: '부산광역시 해운대구',
      acceptedNames: ['한유진', '박재춘', '박건희', '박민하', '박찬희'],
      linkSlotIds: ['sister-band-1', 'sister-band-2', 'sister-band-3'],
    },
    {
      id: 'brother',
      label: '진주네',
      locationLabel: '서울특별시 마포구',
      acceptedNames: ['한동석', '김혜리', '한진주'],
      linkSlotIds: ['brother-band-1'],
    },
    {
      id: 'home',
      label: '은하네',
      locationLabel: '경상남도 김해시 봉황동',
      acceptedNames: ['한영석', '서혜빈', '한은하'],
      linkSlotIds: ['home-band-1'],
    },
  ],
  naverBandLinkSlots: [
    { id: 'parents-band-1', householdId: 'parents', label: '유재동리영빈 밴드', href: 'https://band.us/band/4640764', status: 'active' },
    { id: 'parents-band-2', householdId: 'parents', label: '봉화회 밴드', href: 'https://band.us/band/3889566', status: 'active' },
    { id: 'sister-band-1', householdId: 'sister', label: '건희 밴드', href: 'https://band.us/band/7751923', status: 'active' },
    { id: 'sister-band-2', householdId: 'sister', label: '민하 밴드', href: 'https://band.us/band/60060244', status: 'active' },
    { id: 'sister-band-3', householdId: 'sister', label: '찬희 밴드', href: 'https://band.us/band/85496439', status: 'active' },
    { id: 'brother-band-1', householdId: 'brother', label: '진주네 밴드', href: 'https://band.us/band/102062529', status: 'active' },
    { id: 'home-band-1', householdId: 'home', label: '은하네 밴드', href: 'https://band.us/band/102317167', status: 'active' },
  ],
} as const satisfies HouseholdConfig;

export function normalizeHouseholdName(name: string, locale = householdConfig.locale) {
  return name.replace(/\s+/g, '').trim().toLocaleLowerCase(locale);
}

export function getHouseholdLinks(householdId: HouseholdId, config: HouseholdConfig = householdConfig) {
  return config.naverBandLinkSlots.filter((slot) => slot.householdId === householdId);
}

export function isAcceptedHouseholdName(householdId: HouseholdId, name: string, config: HouseholdConfig = householdConfig) {
  const household = config.households.find((entry) => entry.id === householdId);
  if (!household) return false;
  const normalized = normalizeHouseholdName(name, config.locale);
  return household.acceptedNames.some((acceptedName) => normalizeHouseholdName(acceptedName, config.locale) === normalized);
}

export function validateHouseholdConfig(config: HouseholdConfig) {
  const errors: string[] = [];
  const normalizedNames = new Set<string>();
  const slotIds = new Set<string>();
  const expectedSlotCounts: Record<HouseholdId, number> = {
    parents: 2,
    sister: 3,
    brother: 1,
    home: 1,
  };

  for (const household of config.households) {
    if (household.acceptedNames.length === 0) {
      errors.push(`Household ${household.id} must have at least one accepted name.`);
    }

    for (const name of household.acceptedNames) {
      const normalized = normalizeHouseholdName(name, config.locale);
      if (!normalized) errors.push(`Household ${household.id} has an empty accepted name.`);
      if (normalizedNames.has(normalized)) errors.push(`Duplicate accepted household name: ${name}.`);
      normalizedNames.add(normalized);
    }
  }

  config.naverBandLinkSlots.forEach((slot) => {
    if (slotIds.has(slot.id)) errors.push(`Duplicate Naver Band link slot id: ${slot.id}.`);
    slotIds.add(slot.id);
    if (slot.status !== 'active') errors.push(`Naver Band link slot ${slot.id} must be active.`);
    if (!slot.href.startsWith('https://band.us/band/')) {
      errors.push(`Naver Band link slot ${slot.id} must use an https://band.us/band/ link.`);
    }
  });

  for (const household of config.households) {
    const linkSlots = getHouseholdLinks(household.id, config);
    if (linkSlots.length !== expectedSlotCounts[household.id]) {
      errors.push(`Household ${household.id} must have ${expectedSlotCounts[household.id]} Naver Band slot(s), found ${linkSlots.length}.`);
    }
    for (const slotId of household.linkSlotIds) {
      if (!slotIds.has(slotId)) errors.push(`Household ${household.id} references missing slot ${slotId}.`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    householdCount: config.households.length,
    acceptedNameCount: normalizedNames.size,
    naverBandLinkSlotCount: config.naverBandLinkSlots.length,
  } as const;
}

export const householdConfigValidation = validateHouseholdConfig(householdConfig);
