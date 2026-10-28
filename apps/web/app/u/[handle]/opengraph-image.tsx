import { PublicProfileSchema, type PublicProfile } from '@osh/contracts';
import { ImageResponse } from 'next/og';
import { publicApi } from '@/lib/server-api';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  let profile: PublicProfile | null = null;
  try {
    profile = await publicApi<PublicProfile>(`/public/profiles/${encodeURIComponent(handle)}`, PublicProfileSchema);
  } catch {
    profile = null;
  }
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#0D1117',
          color: '#E6EDF3',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 64,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#2F81F7', fontSize: 28 }}>
          <span>&gt;_</span>
          <span style={{ color: '#8B949E', fontSize: 22 }}>OpenPath</span>
        </div>
        <div>
          <div style={{ fontSize: 64, fontWeight: 600, letterSpacing: '-0.03em' }}>
            {profile?.name ?? 'Private profile'}
          </div>
          <div style={{ marginTop: 12, fontSize: 28, color: '#8B949E' }}>@{handle}</div>
          {profile ? (
            <div style={{ marginTop: 28, display: 'flex', gap: 32, fontSize: 22, color: '#8B949E' }}>
              <span>{profile.stats.merged} merged</span>
              <span>{profile.stats.badges} badges</span>
              <span>{profile.stats.streak} day streak</span>
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 20, color: '#6E7681' }}>
          Opt-in contribution profile · openpath
        </div>
      </div>
    ),
    size,
  );
}
