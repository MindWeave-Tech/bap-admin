import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { CatalogCategoryNode, ProviderMappingRow } from '../lib/types'
import { Screen } from '../components/layout/Screen'
import { EmptyState, Loading, Notice, Panel, StatusTag, Tag } from '../components/ui'

/**
 * Catalog inspection. Synchronisation and the change-review queue are backend
 * capabilities already, but their screens land with the provider onboarding
 * epic that first needs them.
 */
export function CatalogPage() {
  const tree = useQuery({
    queryKey: ['catalog-tree'],
    queryFn: () => api.get<CatalogCategoryNode[]>('/admin/catalog/tree'),
  })

  const mappings = useQuery({
    queryKey: ['catalog-mappings'],
    queryFn: () => api.get<ProviderMappingRow[]>('/admin/catalog/mappings'),
  })

  return (
    <Screen
      number="07"
      title="Service catalog"
      description="The platform's own catalog and the versioned mappings that translate it into each provider's codes. Platform codes stay stable when a provider reorganises."
    >
      <div className="stack">
        {tree.isPending ? (
          <Loading label="Loading catalog" />
        ) : tree.isError ? (
          <Notice>Could not load the catalog.</Notice>
        ) : tree.data.length === 0 ? (
          <EmptyState title="The catalog is empty">
            Categories, billers and products are published through the catalog synchronisation review queue.
          </EmptyState>
        ) : (
          tree.data.map((category) => (
            <Panel
              key={category.code}
              title={category.name}
              subtitle={`${category.code} · ${category.country} · ${category.currency}`}
              actions={<StatusTag status={category.status} />}
              flush
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Biller</th>
                      <th>Product</th>
                      <th>Identifier</th>
                      <th>Amount rules</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {category.billers.flatMap((biller) =>
                      biller.products.length === 0
                        ? [
                            <tr key={biller.code}>
                              <td>
                                <div>{biller.name}</div>
                                <div className="panel__subtitle mono">{biller.code}</div>
                              </td>
                              <td colSpan={4} className="panel__subtitle">
                                No products published
                              </td>
                            </tr>,
                          ]
                        : biller.products.map((product, index) => (
                            <tr key={`${biller.code}-${product.code}`}>
                              <td>
                                {index === 0 ? (
                                  <>
                                    <div>{biller.name}</div>
                                    <div className="panel__subtitle mono">{biller.code}</div>
                                  </>
                                ) : null}
                              </td>
                              <td>
                                <div>{product.name}</div>
                                <div className="panel__subtitle mono">{product.code}</div>
                              </td>
                              <td className="panel__subtitle">
                                {biller.customerIdentifierType ?? '—'}
                                {biller.validationRequired && <div>validation required</div>}
                              </td>
                              <td className="mono">
                                {product.amountType === 'FIXED'
                                  ? `${product.currency} fixed`
                                  : `${product.currency} ${product.minimum ?? '—'} – ${product.maximum ?? '—'}`}
                              </td>
                              <td>
                                <StatusTag status={product.vendable ? 'ACTIVE' : product.status} />
                              </td>
                            </tr>
                          )),
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))
        )}

        <Panel
          title="Provider product mappings"
          subtitle="Versioned and effective-dated, so historical attempts stay reproducible · PRD §12.4"
          flush
        >
          {mappings.isPending ? (
            <Loading label="Loading mappings" />
          ) : mappings.isError ? (
            <div className="panel__body">
              <Notice>Could not load mappings.</Notice>
            </div>
          ) : mappings.data.length === 0 ? (
            <EmptyState title="No provider mappings published" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Internal product</th>
                    <th>Provider</th>
                    <th>Provider biller code</th>
                    <th>Provider product code</th>
                    <th>Amount rules</th>
                    <th>Ver.</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.data.map((mapping) => (
                    <tr key={mapping.id}>
                      <td>
                        <div className="mono">{mapping.productCode}</div>
                        <div className="panel__subtitle mono">{mapping.billerCode}</div>
                      </td>
                      <td>
                        <div>{mapping.providerCode}</div>
                        <div className="panel__subtitle">{mapping.environment}</div>
                      </td>
                      <td className="mono">{mapping.providerBillerCode}</td>
                      <td className="mono">{mapping.providerProductCode}</td>
                      <td className="mono">
                        {mapping.minimum ?? '—'} – {mapping.maximum ?? '—'}
                      </td>
                      <td>{mapping.version}</td>
                      <td>
                        {mapping.live ? (
                          <Tag tone="accent">live</Tag>
                        ) : mapping.effectiveTo ? (
                          <Tag>superseded</Tag>
                        ) : (
                          <Tag>disabled</Tag>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </Screen>
  )
}
