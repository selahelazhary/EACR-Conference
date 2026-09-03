export interface Conference {
  name: string
  short: string
  edition: string
  year: number
  organizer: string
  venue: string
  address: string
  city: string
  country: string
  starts: string
  ends: string
  date_label: string
  timezone: string
  register_url?: string
  abstract_url?: string
}

export interface Section {
  id: string
  name: string
  single: string
  plural: string
  slug: string
  icon: string
  accent: string
  display: 'standard' | 'agenda' | 'people' | 'video' | 'gallery'
  description: string
}

export interface Post {
  id: string
  title: string
  section: string
  date: string
  summary: string
  image?: string
  url: string
  content?: string
  author?: string
  tags?: string[]
  when?: string
  venue?: string
  role?: string
  video?: string
  createdAt: number
  updatedAt: number
}

export interface Sponsor {
  id: string
  name: string
  logo: string
  url?: string
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'partner'
  order: number
  createdAt: number
  updatedAt: number
}

export interface SponsorTier {
  id: string
  name: string
  size: number
}

export interface SiteConfig {
  title: string
  description: string
  url: string
  conference: Conference
  sections: Section[]
  sponsorTiers: SponsorTier[]
}
