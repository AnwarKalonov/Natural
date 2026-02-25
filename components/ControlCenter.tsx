import React, { useEffect, useMemo, useState } from 'react';
import type {
  SubscriptionTier,
  TeamRecord,
  TeamRole,
  UserRecord
} from '../services/platformService';

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  aiUsage: number;
  totalTokens: number;
  totalStorage: number;
  bannedUsers: number;
}

type CenterTab = 'account' | 'teams' | 'billing' | 'usage' | 'admin';

interface ControlCenterProps {
  currentUser: UserRecord;
  users: UserRecord[];
  teams: TeamRecord[];
  metrics: AdminMetrics;
  onBack: () => void;
  onLogout: () => void;
  onVerifyEmail: () => void;
  onSaveProfile: (input: { name: string; username: string; avatar: string; bio: string }) => void;
  onUploadAvatar: (file: File) => Promise<void> | void;
  onChangePassword: (oldPassword: string, newPassword: string) => void;
  onDeleteAccount: () => void;
  onSetSubscription: (tier: SubscriptionTier) => void;
  onCreateTeam: (name: string, description: string) => void;
  onInviteToTeam: (teamId: string, email: string, role: TeamRole) => void;
  onLeaveTeam: (teamId: string) => void;
  onBanUser: (userId: string, banned: boolean) => void;
  onAdjustAiLimit: (userId: string, limit: number) => void;
}

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-[#151719] border border-[#2b3035] rounded-xl p-4">
    <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
    {children}
  </section>
);

export const ControlCenter: React.FC<ControlCenterProps> = ({
  currentUser,
  users,
  teams,
  metrics,
  onBack,
  onLogout,
  onVerifyEmail,
  onSaveProfile,
  onUploadAvatar,
  onChangePassword,
  onDeleteAccount,
  onSetSubscription,
  onCreateTeam,
  onInviteToTeam,
  onLeaveTeam,
  onBanUser,
  onAdjustAiLimit
}) => {
  const [tab, setTab] = useState<CenterTab>('account');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    name: currentUser.name,
    username: currentUser.username,
    avatar: currentUser.avatar,
    bio: currentUser.bio
  });
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    setProfile({
      name: currentUser.name,
      username: currentUser.username,
      avatar: currentUser.avatar,
      bio: currentUser.bio
    });
  }, [currentUser]);

  const [passwordState, setPasswordState] = useState({ oldPassword: '', newPassword: '' });
  const [teamState, setTeamState] = useState({ name: '', description: '' });
  const [inviteState, setInviteState] = useState({ teamId: '', email: '', role: 'viewer' as TeamRole });

  const userTeams = useMemo(
    () => teams.filter(team => team.members.some(member => member.userId === currentUser.id)),
    [teams, currentUser.id]
  );

  const notify = async (fn: () => void | Promise<void>, okMessage: string) => {
    try {
      await fn();
      setError(null);
      setSuccess(okMessage);
    } catch (e: any) {
      setSuccess(null);
      setError(e?.message || 'Action failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0e1011] text-[#e6edf3] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Control Center</h1>
            <p className="text-[#8d96a0] text-sm">Account, teams, usage, billing and admin tools.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onBack} className="px-3 py-2 rounded-lg border border-[#2b3035] hover:bg-[#1c1e21] text-sm">Back</button>
            <button onClick={onLogout} className="px-3 py-2 rounded-lg bg-white text-black text-sm font-semibold">Logout</button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setTab('account')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'account' ? 'bg-white text-black' : 'bg-[#151719] border border-[#2b3035]'}`}>Account</button>
          <button onClick={() => setTab('teams')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'teams' ? 'bg-white text-black' : 'bg-[#151719] border border-[#2b3035]'}`}>Teams</button>
          <button onClick={() => setTab('billing')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'billing' ? 'bg-white text-black' : 'bg-[#151719] border border-[#2b3035]'}`}>Billing</button>
          <button onClick={() => setTab('usage')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'usage' ? 'bg-white text-black' : 'bg-[#151719] border border-[#2b3035]'}`}>Usage</button>
          {currentUser.isAdmin && (
            <button onClick={() => setTab('admin')} className={`px-3 py-1.5 rounded-lg text-sm ${tab === 'admin' ? 'bg-white text-black' : 'bg-[#151719] border border-[#2b3035]'}`}>Admin</button>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        {success && <p className="text-green-400 text-sm mb-3">{success}</p>}

        {tab === 'account' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Profile">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {/^https?:\/\//i.test(profile.avatar) ? (
                    <img src={profile.avatar} alt="Profile" className="w-10 h-10 rounded-full object-cover border border-[#2b3035]" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#1c1e21] border border-[#2b3035] flex items-center justify-center text-white font-bold text-sm">
                      {(profile.avatar || profile.name || 'U').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <label className={`px-3 py-2 rounded border border-[#2b3035] text-sm cursor-pointer ${avatarUploading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-[#1c1e21]'}`}>
                    {avatarUploading ? 'Uploading...' : 'Upload Profile Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setAvatarUploading(true);
                        void notify(() => onUploadAvatar(file), 'Profile photo updated.')
                          .finally(() => setAvatarUploading(false));
                      }}
                    />
                  </label>
                </div>
                <input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="Name" />
                <input value={profile.username} onChange={e => setProfile({ ...profile, username: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="Username" />
                <input
                  value={profile.avatar}
                  onChange={e => {
                    const next = e.target.value;
                    const normalized = /^https?:\/\//i.test(next) ? next : next.toUpperCase().slice(0, 2);
                    setProfile({ ...profile, avatar: normalized });
                  }}
                  className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm"
                  placeholder="Initials fallback (e.g. AK)"
                />
                <textarea value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} className="w-full h-24 bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="Bio" />
                <button onClick={() => notify(() => onSaveProfile(profile), 'Profile updated.')} className="px-3 py-2 rounded bg-white text-black text-sm font-semibold">Save profile</button>
              </div>
            </Card>

            <Card title="Security">
              <div className="space-y-3">
                <div className="text-sm text-[#8d96a0]">Email: <span className="text-white">{currentUser.email}</span></div>
                <div className="text-sm text-[#8d96a0]">Verification: {currentUser.emailVerified ? <span className="text-green-400">Verified</span> : <span className="text-yellow-300">Unverified</span>}</div>
                {!currentUser.emailVerified && (
                  <button onClick={() => notify(onVerifyEmail, 'Email marked as verified.')} className="px-3 py-2 rounded border border-[#2b3035] hover:bg-[#1c1e21] text-sm">Verify email</button>
                )}
                <input type="password" value={passwordState.oldPassword} onChange={e => setPasswordState({ ...passwordState, oldPassword: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="Current password" />
                <input type="password" value={passwordState.newPassword} onChange={e => setPasswordState({ ...passwordState, newPassword: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="New password" />
                <button onClick={() => notify(() => onChangePassword(passwordState.oldPassword, passwordState.newPassword), 'Password updated.')} className="px-3 py-2 rounded border border-[#2b3035] hover:bg-[#1c1e21] text-sm">Change password</button>
                <button onClick={() => { if (window.confirm('Delete your account permanently?')) notify(onDeleteAccount, 'Account deleted.'); }} className="px-3 py-2 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-sm">Delete account</button>
              </div>
            </Card>
          </div>
        )}

        {tab === 'teams' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Create Team">
              <div className="space-y-3">
                <input value={teamState.name} onChange={e => setTeamState({ ...teamState, name: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="Team name" />
                <textarea value={teamState.description} onChange={e => setTeamState({ ...teamState, description: e.target.value })} className="w-full h-20 bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="Description" />
                <button onClick={() => notify(() => onCreateTeam(teamState.name, teamState.description), 'Team created.')} className="px-3 py-2 rounded bg-white text-black text-sm font-semibold">Create team</button>
              </div>
            </Card>

            <Card title="Invite Member">
              <div className="space-y-3">
                <select value={inviteState.teamId} onChange={e => setInviteState({ ...inviteState, teamId: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm">
                  <option value="">Select team</option>
                  {userTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <input value={inviteState.email} onChange={e => setInviteState({ ...inviteState, email: e.target.value })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm" placeholder="member@email.com" />
                <select value={inviteState.role} onChange={e => setInviteState({ ...inviteState, role: e.target.value as TeamRole })} className="w-full bg-[#0e1011] border border-[#2b3035] rounded px-3 py-2 text-sm">
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button onClick={() => notify(() => onInviteToTeam(inviteState.teamId, inviteState.email, inviteState.role), 'Invite created.')} className="px-3 py-2 rounded border border-[#2b3035] hover:bg-[#1c1e21] text-sm">Invite</button>
              </div>
            </Card>

            <Card title="Your Teams">
              <div className="space-y-2 text-sm">
                {userTeams.length === 0 && <p className="text-[#8d96a0]">No teams yet.</p>}
                {userTeams.map(team => (
                  <div key={team.id} className="border border-[#2b3035] rounded p-2 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{team.name}</p>
                      <p className="text-[#8d96a0] text-xs">{team.members.length} members, {team.invites.length} invites</p>
                    </div>
                    <button onClick={() => notify(() => onLeaveTeam(team.id), 'You left the team.')} className="text-xs px-2 py-1 rounded border border-[#2b3035] hover:bg-[#1c1e21]">Leave</button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {tab === 'billing' && (
          <Card title="Subscription">
            <div className="space-y-4 text-sm">
              <p>Current tier: <span className="text-white font-semibold uppercase">{currentUser.subscription}</span></p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['free', 'pro', 'team', 'enterprise'] as SubscriptionTier[]).map(tier => (
                  <button key={tier} onClick={() => notify(() => onSetSubscription(tier), `Plan changed to ${tier}.`)} className={`px-3 py-2 rounded border ${currentUser.subscription === tier ? 'border-white bg-white text-black' : 'border-[#2b3035] hover:bg-[#1c1e21]'}`}>
                    {tier.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-[#8d96a0]">Feature gates now supported locally by tier and AI limits.</p>
            </div>
          </Card>
        )}

        {tab === 'usage' && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card title="AI Requests"><p className="text-xl font-bold">{currentUser.usage.aiRequests}</p></Card>
            <Card title="Tokens"><p className="text-xl font-bold">{currentUser.usage.tokensUsed}</p></Card>
            <Card title="Projects"><p className="text-xl font-bold">{currentUser.usage.projectsCreated}</p></Card>
            <Card title="Storage"><p className="text-xl font-bold">{Math.round(currentUser.usage.storageBytes / 1024)} KB</p></Card>
            <Card title="AI Limit"><p className="text-xl font-bold">{currentUser.usage.aiLimit}</p></Card>
          </div>
        )}

        {tab === 'admin' && currentUser.isAdmin && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <Card title="Total Users"><p className="text-xl font-bold">{metrics.totalUsers}</p></Card>
              <Card title="Active Users"><p className="text-xl font-bold">{metrics.activeUsers}</p></Card>
              <Card title="AI Usage"><p className="text-xl font-bold">{metrics.aiUsage}</p></Card>
              <Card title="Tokens"><p className="text-xl font-bold">{metrics.totalTokens}</p></Card>
              <Card title="Storage"><p className="text-xl font-bold">{Math.round(metrics.totalStorage / 1024)} KB</p></Card>
              <Card title="Banned"><p className="text-xl font-bold">{metrics.bannedUsers}</p></Card>
            </div>

            <Card title="User Controls">
              <div className="space-y-2 text-sm">
                {users.map(user => (
                  <div key={user.id} className="border border-[#2b3035] rounded p-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{user.name} ({user.email})</p>
                      <p className="text-[#8d96a0] text-xs">tier: {user.subscription} | aiLimit: {user.usage.aiLimit} | {user.isBanned ? 'banned' : 'active'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => notify(() => onBanUser(user.id, !user.isBanned), user.isBanned ? 'User unbanned.' : 'User banned.')} className="text-xs px-2 py-1 rounded border border-[#2b3035] hover:bg-[#1c1e21]">{user.isBanned ? 'Unban' : 'Ban'}</button>
                      <button onClick={() => {
                        const raw = window.prompt('Set AI limit', String(user.usage.aiLimit));
                        if (!raw) return;
                        const limit = Number(raw);
                        notify(() => onAdjustAiLimit(user.id, limit), 'AI limit updated.');
                      }} className="text-xs px-2 py-1 rounded border border-[#2b3035] hover:bg-[#1c1e21]">Set limit</button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
