import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { Permission, type PermissionName } from '../lib/permissions'
import { Screen } from '../components/layout/Screen'
import { Button, Notice, Panel, Tag } from '../components/ui'

/**
 * How to use the console, organised by what somebody is trying to do.
 *
 * In the console rather than in a repository because that is where an operator
 * is when the question arises, and a guide nobody can reach while working is a
 * guide nobody reads. Written around tasks rather than screens: "a customer says
 * they were charged and got nothing" is what people actually arrive with.
 */

interface Section {
  id: string
  title: string
  blurb: string
  permission?: PermissionName
  entries: { question: string; answer: React.ReactNode }[]
}

const SECTIONS: Section[] = [
  {
    id: 'daily',
    title: 'Every day',
    blurb: 'The half-dozen things worth looking at before anything else.',
    entries: [
      {
        question: 'Where do I start?',
        answer: (
          <>
            The <Link to="/">Overview</Link> first — it shows outcomes, how long unresolved transactions have been
            waiting, and anything queued for approval. Then <Link to="/incidents">Incidents</Link>, which is what the
            platform noticed on its own. Between them they answer "is anything wrong" without you having to hunt.
          </>
        ),
      },
      {
        question: 'What does the aging bar mean?',
        answer: (
          <>
            How long transactions have been unresolved. The last bucket is the one that matters: past 24 hours a
            transaction is holding a customer's money in reservation and needs a person today. Everything before that
            is normal traffic in flight.
          </>
        ),
      },
      {
        question: 'The queue is empty. Is that good?',
        answer: (
          <>
            Only if something has been looking. Alert evaluation runs every five minutes and reconciliation runs
            nightly; an empty queue means the last run found nothing. A batch that has <em>never</em> been compared is
            shown as such rather than as clean — the platform tries not to let "not measured" look like "fine".
          </>
        ),
      },
    ],
  },
  {
    id: 'transactions',
    title: 'A customer has a problem',
    blurb: 'Finding one transaction and working out what happened to it.',
    permission: Permission.TransactionsView,
    entries: [
      {
        question: 'How do I find their transaction?',
        answer: (
          <>
            <Link to="/transactions">Transactions</Link> searches on every reference anybody might quote you — ours,
            the client's, the payment authorization, the provider's — and on the customer's phone or meter number.
            You can paste the raw identifier; it is matched by hash without ever being stored in the clear.
          </>
        ),
      },
      {
        question: 'It says UNKNOWN. Did the customer get their airtime?',
        answer: (
          <>
            Nobody knows yet, and that is what the status means rather than a euphemism for failed. The platform keeps
            asking the provider on a schedule for 24 hours. What it will <em>never</em> do is guess, because guessing
            wrong in one direction charges twice and in the other refunds a delivery that happened. If it is still
            unknown after 24 hours it moves to <Link to="/manual-review">Manual review</Link> for a person to settle.
          </>
        ),
      },
      {
        question: 'Can I just mark it successful?',
        answer: (
          <>
            From UNKNOWN or MANUAL REVIEW, yes — with a reason, which is recorded against your name. From FAILED, no,
            and that is deliberate: a failure is only recorded when the platform has proof no value moved, so a
            provider claiming otherwise is a dispute to take up with them rather than a record to rewrite. The client
            has already been told it failed and may have refunded the customer.
          </>
        ),
      },
      {
        question: 'Why can I not see the full phone number?',
        answer: (
          <>
            Customer identifiers are masked unless your role may unmask them, and unmasking is written to the audit
            log. The same rule applies to exports, so a spreadsheet cannot be used to get around it.
          </>
        ),
      },
    ],
  },
  {
    id: 'providers',
    title: 'Providers and routing',
    blurb: 'Getting a provider into service, and taking it out again.',
    permission: Permission.ProvidersView,
    entries: [
      {
        question: 'I created a provider and cannot set it to Active.',
        answer: (
          <>
            A provider goes <Tag>draft</Tag> → <Tag>testing</Tag> → <Tag>active</Tag>. From draft the only options are
            Testing and Disabled, because a provider proves itself before customers meet it. Move it to Testing,
            set its credentials, sync its catalog and run its contract tests — then activate. The provider page tells
            you the same thing next to its status.
          </>
        ),
      },
      {
        question: 'How do I take a provider out of service right now?',
        answer: (
          <>
            Change its status to Suspended or Maintenance. Both stop new traffic immediately. Neither touches
            transactions already in flight — those settle by requery regardless, which is why pulling a provider is
            safe to do in a hurry.
          </>
        ),
      },
      {
        question: 'What is the difference between Degraded and the circuit breaker?',
        answer: (
          <>
            Three different things, deliberately. <strong>Status</strong> is what a person declared.{' '}
            <strong>Health</strong> is what the traffic says. The <strong>breaker</strong> is a decision made from
            health. A provider can be Active, unhealthy and out of rotation all at once — the provider page shows
            all three so you can tell which one is stopping traffic.
          </>
        ),
      },
      {
        question: 'Why is a provider excluded from routing when its balance looks fine?',
        answer: (
          <>
            Open the <Link to="/transactions">transaction</Link> and read its routing decision: every candidate is
            listed with the reason it was not chosen. Balance is only one of them — a breaker, an enablement rule, a
            daily limit or an amount outside the product's range will all exclude a provider that otherwise looks
            healthy.
          </>
        ),
      },
    ],
  },
  {
    id: 'money',
    title: 'Balances and reconciliation',
    blurb: 'Making sure the books agree with the provider.',
    permission: Permission.ProviderBalancesView,
    entries: [
      {
        question: 'What does "never read" mean on the balance register?',
        answer: (
          <>
            Nobody has polled that wallet. It is shown rather than hidden because an unmonitored wallet that appears
            nowhere is the exact failure the screen exists to prevent. "Never read", "too old to act on" and a real
            figure are three different states and the register shows them as themselves.
          </>
        ),
      },
      {
        question: 'I entered a balance and routing is ignoring it.',
        answer: (
          <>
            A manually entered balance is a proposal until somebody else countersigns it — you cannot approve your
            own. A reading from the provider's own API is evidence and approves itself; a typed one is an assertion,
            and a mistyped figure would take a healthy provider out of rotation.
          </>
        ),
      },
      {
        question: 'How do I reconcile a provider?',
        answer: (
          <>
            On <Link to="/reconciliation">Reconciliation</Link>: open a batch for the provider and window, upload
            their statement, check what did not parse, then press Compare. Nothing is concluded from an import until
            you compare, and re-uploading a corrected file supersedes the first without erasing it.
          </>
        ),
      },
      {
        question: 'What should I look at first in the variance queue?',
        answer: (
          <>
            It is already ordered for you — by what a finding would cost, not by when it was found.{' '}
            <strong>"Value we never recorded"</strong> is top: the provider moved money against a transaction we have
            no record of. <em>Provider has no record</em> is usually a failure both sides agree about.
          </>
        ),
      },
    ],
  },
  {
    id: 'incidents',
    title: 'Incidents and alerts',
    blurb: 'What the platform noticed without being asked.',
    entries: [
      {
        question: 'What is the difference between an alert and an incident?',
        answer: (
          <>
            An alert is one observation. An incident groups every alert about the same thing, so a provider flapping
            forty times is one item on your list rather than forty. The incident carries the count.
          </>
        ),
      },
      {
        question: 'Why can I not close this incident?',
        answer: (
          <>
            Because it is still firing. An incident has to be resolved first, and then stay quiet for half an hour
            before it can be closed — closing something still alerting hides a live problem behind a tidy status.
          </>
        ),
      },
      {
        question: 'An alert says "never delivered".',
        answer: (
          <>
            The platform raised it and could not get it to anybody — usually a mail channel with no recipients
            configured. Worth fixing, because it means the queue is the only place that alert exists.
          </>
        ),
      },
    ],
  },
  {
    id: 'access',
    title: 'Access and accounts',
    blurb: 'Getting people in, and out.',
    entries: [
      {
        question: 'How do I add somebody?',
        answer: (
          <>
            <Link to="/users">Users and roles</Link> → Invite. They get an email with a link that expires in 72 hours;
            nobody else ever sees it, including you. If it expires, invite them again.
          </>
        ),
      },
      {
        question: 'I have forgotten my password.',
        answer: (
          <>
            Use the link on the sign-in page. The reset works once, expires within the hour, and signs out every other
            session on your account.
          </>
        ),
      },
      {
        question: 'Somebody has left.',
        answer: (
          <>
            Suspend them on <Link to="/users">Users and roles</Link>. Their sessions end on their next request rather
            than whenever their token would have expired.
          </>
        ),
      },
      {
        question: 'It asked for my password again in the middle of something.',
        answer: (
          <>
            Sensitive actions need authentication within the last 15 minutes. Confirming does not restart what you
            were doing — it lets the action through.
          </>
        ),
      },
    ],
  },
]

export function GuidePage() {
  const { can } = useAuth()
  const [open, setOpen] = useState<string | null>('daily')

  // Only what this operator can actually reach. A guide to screens somebody
  // cannot open is a list of things to ask for.
  const visible = SECTIONS.filter((section) => !section.permission || can(section.permission))

  return (
    <Screen
      number="12"
      title="Using this console"
      description="Answers to what people actually arrive with, rather than a tour of the menus"
    >
      <div className="stack">
        <Notice tone="neutral" title="Two things worth knowing before anything else">
          The platform never guesses about money. Where it cannot prove what happened it says so — UNKNOWN means
          unknown, and an unmeasured figure is shown as unmeasured rather than as zero. And every consequential action
          asks for a reason, which is recorded against your name in the <Link to="/audit-logs">audit log</Link>.
        </Notice>

        {visible.map((section) => (
          <Panel
            key={section.id}
            title={section.title}
            subtitle={section.blurb}
            actions={
              <Button
                variant="secondary"
                // Named for its section. Five buttons all called "Show" tell a
                // screen-reader user nothing about which one they are on.
                aria-label={`${open === section.id ? 'Hide' : 'Show'} ${section.title}`}
                onClick={() => setOpen(open === section.id ? null : section.id)}
              >
                {open === section.id ? 'Hide' : 'Show'}
              </Button>
            }
          >
            {open === section.id && (
              <dl className="stack">
                {section.entries.map((entry) => (
                  <div key={entry.question}>
                    <dt>
                      <strong>{entry.question}</strong>
                    </dt>
                    <dd className="panel__subtitle">{entry.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>
        ))}
      </div>
    </Screen>
  )
}
