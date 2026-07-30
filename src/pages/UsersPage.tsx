import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { AdminUser, RoleSummary } from '../lib/types'
import { Notice, Tag, Button, Panel, Dialog, EmptyState, Field, Loading, StatusTag } from '../components/ui'
import { Screen } from '../components/layout/Screen'

export function UsersPage() {
  const queryClient = useQueryClient()
  const [inviting, setInviting] = useState(false)
  const [invitation, setInvitation] = useState<{ email: string } | null>(null)
  const [editing, setEditing] = useState<AdminUser | null>(null)

  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<AdminUser[]>('/admin/users') })
  const roles = useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleSummary[]>('/admin/roles') })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['users'] })

  const statusMutation = useMutation({
    mutationFn: ({ user, status, reason }: { user: AdminUser; status: string; reason: string }) =>
      api.patch<AdminUser>(`/admin/users/${user.id}/status`, { status, reason }),
    onSuccess: refresh,
  })

  return (
      <Screen number="02"
        title="Users and roles"
        description="Administrator accounts, their roles, and account status. Suspending or locking an account ends its active sessions immediately."
        actions={<Button onClick={() => setInviting(true)}>Invite user</Button>}
      >

      {statusMutation.isError && (
        <div style={{ marginBottom: "var(--space-4)" }}>
          <Notice>
            {statusMutation.error instanceof ApiError
              ? statusMutation.error.message
              : 'Could not update the account.'}
          </Notice>
        </div>
      )}

      <Panel flush>
        {users.isPending ? (
          <Loading label="Loading users" />
        ) : users.isError ? (
          <div style={{ padding: "var(--space-4)" }}>
            <Notice>Could not load users.</Notice>
          </div>
        ) : users.data.length === 0 ? (
          <EmptyState title="No administrators yet">Invite your first administrator to get started.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th>Two-factor</th>
                  <th>Last sign-in</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{user.name}</div>
                      <div className="panel__subtitle">{user.email}</div>
                    </td>
                    <td>
                      <StatusTag status={user.status} />
                    </td>
                    <td>
                      <div className="row">
                        {user.roles.length === 0 ? (
                          <span className="panel__subtitle">None</span>
                        ) : (
                          user.roles.map((role) => (
                            <Tag key={role}>
                              {roles.data?.find((candidate) => candidate.name === role)?.label ?? role}
                            </Tag>
                          ))
                        )}
                      </div>
                    </td>
                    <td>
                      {user.twoFactorEnabled ? (
                        <Tag tone="neutral">Enabled</Tag>
                      ) : (
                        <Tag tone="accent">Not enabled</Tag>
                      )}
                    </td>
                    <td className="panel__subtitle">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <div className="row">
                        <Button variant="secondary"  onClick={() => setEditing(user)}>
                          Roles
                        </Button>
                        {user.status === 'active' ? (
                          <Button
                            variant="ghost"
                            
                            onClick={() => {
                              const reason = window.prompt('Reason for suspending this account?')
                              if (reason)
                                statusMutation.mutate({ user, status: 'suspended', reason })
                            }}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            
                            onClick={() =>
                              statusMutation.mutate({ user, status: 'active', reason: 'Reactivated by administrator.' })
                            }
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {inviting && (
        <InviteDialog
          roles={roles.data ?? []}
          onClose={() => setInviting(false)}
          onInvited={(email) => {
            setInviting(false)
            setInvitation({ email })
            refresh()
          }}
        />
      )}

      {invitation && (
        <Dialog
          title="Invitation sent"
          onClose={() => setInvitation(null)}
          footer={<Button onClick={() => setInvitation(null)}>Done</Button>}
        >
          <p>
            An invitation is on its way to <strong>{invitation.email}</strong>. It expires in 72 hours.
          </p>
          <p className="panel__subtitle">
            {/*
              The link used to be shown here for an administrator to copy and
              send on. That put a credential for a new administrative account
              into this browser and the API's logs, so the invitee is now the
              only person who ever sees it.
            */}
            Nobody but the invitee sees the link. If it expires or does not arrive, invite them again.
          </p>
        </Dialog>
      )}

      {editing && (
        <RolesDialog
          user={editing}
          roles={roles.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
    </Screen>
  )
}

function InviteDialog({
  roles,
  onClose,
  onInvited,
}: {
  roles: RoleSummary[]
  onClose: () => void
  onInvited: (email: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: () => api.post<AdminUser>('/admin/users', { name, email, roles: selected }),
    onSuccess: (user) => onInvited(user.email),
  })

  const fieldErrors = mutation.error instanceof ApiError ? mutation.error.fieldErrors() : {}

  return (
    <Dialog
      title="Invite an administrator"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Send invitation
          </Button>
        </>
      }
    >
      {mutation.isError && Object.keys(fieldErrors).length === 0 && (
        <Notice>{mutation.error instanceof ApiError ? mutation.error.message : 'Could not create the invitation.'}</Notice>
      )}
      <Field label="Full name" value={name} error={fieldErrors.name} onChange={(e) => setName(e.target.value)} />
      <Field
        label="Email"
        type="email"
        value={email}
        error={fieldErrors.email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <RolePicker roles={roles} selected={selected} onChange={setSelected} />
    </Dialog>
  )
}

function RolesDialog({
  user,
  roles,
  onClose,
  onSaved,
}: {
  user: AdminUser
  roles: RoleSummary[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = useState<string[]>(user.roles)

  const mutation = useMutation({
    mutationFn: () => api.put(`/admin/users/${user.id}/roles`, { roles: selected }),
    onSuccess: onSaved,
  })

  return (
    <Dialog
      title={`Roles for ${user.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Save roles
          </Button>
        </>
      }
    >
      {mutation.isError && <Notice>Could not update roles.</Notice>}
      <RolePicker roles={roles} selected={selected} onChange={setSelected} />
    </Dialog>
  )
}

function RolePicker({
  roles,
  selected,
  onChange,
}: {
  roles: RoleSummary[]
  selected: string[]
  onChange: (roles: string[]) => void
}) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend className="field__label" style={{ padding: 0, marginBottom: 6 }}>
        Roles
      </legend>
      <div className="stack" style={{ gap: 6 }}>
        {roles.map((role) => (
          <label key={role.name} className="row" style={{ gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selected.includes(role.name)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...selected, role.name]
                    : selected.filter((name) => name !== role.name),
                )
              }
            />
            <span>
              {role.label}
              <span className="panel__subtitle"> · {role.permissions.length} permissions</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
