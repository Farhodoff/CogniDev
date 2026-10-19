/** Integratsiya testlari uchun store seed. */
import { useSynapse } from '../lib/store';

export function seedTestWorkspace() {
  useSynapse.setState({
    tasks: [],
    notes: {},
    checklists: {},
    selectedTaskId: null,
    activeWorkspaceId: 'ws-personal',
    dbMode: 'memory',
    groups: [],
    activeGroupId: null,
    activeTag: null,
    quickFilter: null,
    search: '',
    sortOrder: 'newest',
    prompts: [],
    userProfile: {
      id: 'current',
      full_name: 'Test Dasturchi',
      username: 'tester',
      title: 'QA Engineer',
      email: 'tester@cognidev.local',
      github: '',
      avatar_color: '#0284c7',
      avatar_initials: 'T',
      bio: '',
      role: 'Tester',
      updated_at: new Date().toISOString(),
    },
  });
}
