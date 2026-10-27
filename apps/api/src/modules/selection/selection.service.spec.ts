import { SelectionService } from './selection.service';

const issue = {
  id: 'acme/widgets#1',
  number: 1,
  repoFullName: 'acme/widgets',
  organization: 'acme',
  title: 'Add a migration guide',
  url: 'https://github.com/acme/widgets/issues/1',
  labels: ['good first issue'],
  language: 'TypeScript',
  level: 'BEGINNER',
  repoDescription: 'Widgets',
  stars: 10,
  activityAt: new Date(),
  fetchedAt: new Date(),
  assigned: false,
  state: 'open',
};

const selection = {
  id: 's1',
  userId: 'u1',
  status: 'IN_PROGRESS',
  prUrl: null,
  selectedAt: new Date(),
  updatedAt: new Date(),
  lastSyncedAt: null,
  issue,
};

function setup() {
  const tx = {
    selection: { update: jest.fn().mockResolvedValue({ ...selection, status: 'PR_OPEN' }) },
    progressEvent: { create: jest.fn().mockResolvedValue({ id: 'e1' }) },
  };
  const prisma = {
    selection: { findUnique: jest.fn().mockResolvedValue(selection) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const notifications = { create: jest.fn().mockResolvedValue({}) };
  const queue = { add: jest.fn().mockResolvedValue(undefined) };
  const service = new SelectionService(
    prisma as never,
    notifications as never,
    queue as never,
  );
  return { service, notifications, queue };
}

describe('SelectionService.update', () => {
  it('creates an in-app notification when the status changes', async () => {
    const { service, notifications } = setup();
    await service.update('u1', 's1', { status: 'PR_OPEN' });
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        title: expect.stringContaining('PR Open'),
        link: expect.stringContaining('/issues/'),
      }),
    );
  });

  it('does not notify when only the note changes', async () => {
    const { service, notifications } = setup();
    await service.update('u1', 's1', { note: 'Started reading the guide' });
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
