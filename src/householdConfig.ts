export type HouseholdMember = {
  readonly id: string;
  readonly displayName: string;
  readonly acceptedNames: readonly string[];
};

export type NaverBandLinkSlot = {
  readonly id: string;
  readonly label: string;
  readonly placeholderHref: `https://band.us/${string}`;
  readonly status: 'placeholder';
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

export type HouseholdConfig = {
  readonly id: 'korea-family-map-zoom-household';
  readonly locale: 'ko-KR';
  readonly members: readonly HouseholdMember[];
  readonly naverBandLinkSlots: SevenNaverBandLinkSlots;
};

export const householdConfig = {
  id: 'korea-family-map-zoom-household',
  locale: 'ko-KR',
  members: [
    { id: 'geonhui', displayName: '건희', acceptedNames: ['건희', 'Geonhui', 'Geon-hui'] },
    { id: 'minha', displayName: '민하', acceptedNames: ['민하', 'Minha', 'Min-ha'] },
    { id: 'chanhui', displayName: '찬희', acceptedNames: ['찬희', 'Chanhui', 'Chan-hui'] },
  ],
  naverBandLinkSlots: [
    { id: 'naver-band-1', label: 'Naver Band link slot 1', placeholderHref: 'https://band.us/band/placeholder-1', status: 'placeholder' },
    { id: 'naver-band-2', label: 'Naver Band link slot 2', placeholderHref: 'https://band.us/band/placeholder-2', status: 'placeholder' },
    { id: 'naver-band-3', label: 'Naver Band link slot 3', placeholderHref: 'https://band.us/band/placeholder-3', status: 'placeholder' },
    { id: 'naver-band-4', label: 'Naver Band link slot 4', placeholderHref: 'https://band.us/band/placeholder-4', status: 'placeholder' },
    { id: 'naver-band-5', label: 'Naver Band link slot 5', placeholderHref: 'https://band.us/band/placeholder-5', status: 'placeholder' },
    { id: 'naver-band-6', label: 'Naver Band link slot 6', placeholderHref: 'https://band.us/band/placeholder-6', status: 'placeholder' },
    { id: 'naver-band-7', label: 'Naver Band link slot 7', placeholderHref: 'https://band.us/band/placeholder-7', status: 'placeholder' },
  ],
} as const satisfies HouseholdConfig;

export function validateHouseholdConfig(config: HouseholdConfig) {
  const errors: string[] = [];
  const normalizedNames = new Set<string>();
  const slotIds = new Set<string>();

  for (const member of config.members) {
    if (member.acceptedNames.length === 0) {
      errors.push(`Household member ${member.id} must have at least one accepted name.`);
    }

    for (const name of member.acceptedNames) {
      const normalized = name.trim().toLocaleLowerCase(config.locale);
      if (!normalized) errors.push(`Household member ${member.id} has an empty accepted name.`);
      if (normalizedNames.has(normalized)) errors.push(`Duplicate accepted household name: ${name}.`);
      normalizedNames.add(normalized);
    }
  }

  config.naverBandLinkSlots.forEach((slot, index) => {
    if (slotIds.has(slot.id)) errors.push(`Duplicate Naver Band link slot id: ${slot.id}.`);
    slotIds.add(slot.id);
    if (slot.status !== 'placeholder') errors.push(`Naver Band link slot ${slot.id} must remain placeholder until a real link is supplied.`);
    if (!slot.placeholderHref.startsWith('https://band.us/')) {
      errors.push(`Naver Band link slot ${slot.id} must use an https://band.us/ placeholder.`);
    }
    if (!slot.placeholderHref.endsWith(`placeholder-${index + 1}`)) {
      errors.push(`Naver Band link slot ${slot.id} placeholder should match its 1-based slot number.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    acceptedNameCount: normalizedNames.size,
    naverBandLinkSlotCount: config.naverBandLinkSlots.length,
  } as const;
}

export const householdConfigValidation = validateHouseholdConfig(householdConfig);
