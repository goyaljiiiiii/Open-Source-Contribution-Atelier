--- /dev/null
+++ b/frontend/src/pages/BountiesPage.tsx
@@ -0,0 +1,228 @@
+import { useEffect, useMemo, useState } from 'react';
+import { useSearchParams } from 'react-router-dom';
+
+interface Bounty {
+  id: string;
+  title: string;
+  reward: number;
+  tags: string[];
+  difficulty: 'easy' | 'medium' | 'hard';
+}
+
+const MOCK_BOUNTIES: Bounty[] = [
+  { id: '1', title: 'Fix login redirect', reward: 25, tags: ['bug', 'auth'], difficulty: 'easy' },
+  { id: '2', title: 'Add dark mode toggle', reward: 75, tags: ['feature', 'ui'], difficulty: 'medium' },
+  { id: '3', title: 'Optimize DB queries', reward: 150, tags: ['performance', 'backend'], difficulty: 'hard' },
+  { id: '4', title: 'Update dependencies', reward: 30, tags: ['maintenance'], difficulty: 'easy' },
+  { id: '5', title: 'Implement webhook retry', reward: 200, tags: ['feature', 'reliability'], difficulty: 'hard' },
+  { id: '6', title: 'Improve a11y labels', reward: 50, tags: ['a11y', 'ui'], difficulty: 'medium' },
+];
+
+const MIN_REWARD = 10;
+const MAX_REWARD = 500;
+
+export default function BountiesPage() {
+  const [searchParams, setSearchParams] = useSearchParams();
+
+  const initialMinReward = useMemo(() => {
+    const param = searchParams.get('minReward');
+    if (param === null) return MIN_REWARD;
+    const parsed = Number.parseInt(param, 10);
+    if (Number.isNaN(parsed)) return MIN_REWARD;
+    return Math.min(Math.max(parsed, MIN_REWARD), MAX_REWARD);
+  }, []);
+
+  const [minReward, setMinReward] = useState(initialMinReward);
+
+  useEffect(() => {
+    const params = new URLSearchParams(searchParams);
+    if (minReward === MIN_REWARD) {
+      params.delete('minReward');
+    } else {
+      params.set('minReward', String(minReward));
+    }
+    setSearchParams(params, { replace: true });
+  }, [minReward, searchParams, setSearchParams]);
+
+  const filteredBounties = useMemo(
+    () => MOCK_BOUNTIES.filter((bounty) => bounty.reward >= minReward),
+    [minReward],
+  );
+
+  return (
+    <div className="bounties-page" style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
+      <h1 style={{ marginBottom: '1.5rem', color: '#0f172a' }}>Open Bounties</h1>
+
+      <section
+        aria-label="Bounty filters"
+        style={{
+          marginBottom: '2rem',
+          padding: '1.25rem',
+          borderRadius: '0.75rem',
+          backgroundColor: '#f8fafc',
+          border: '1px solid #e2e8f0',
+        }}
+      >
+        <label htmlFor="min-reward-slider" style={{ display: 'block', fontWeight: 600, color: '#334155' }}>
+          Minimum reward: ${minReward}
+        </label>
+        <input
+          id="min-reward-slider"
+          type="range"
+          min={MIN_REWARD}
+          max={MAX_REWARD}
+          step={5}
+          value={minReward}
+          onChange={(event) => setMinReward(Number(event.target.value))}
+          aria-valuemin={MIN_REWARD}
+          aria-valuemax={MAX_REWARD}
+          aria-valuenow={minReward}
+          aria-valuetext={`$${minReward}`}
+          style={{ width: '100%', marginTop: '0.75rem', accentColor: '#0ea5e9' }}
+        />
+        <div
+          style={{
+            display: 'flex',
+            justifyContent: 'space-between',
+            marginTop: '0.5rem',
+            fontSize: '0.875rem',
+            color: '#64748b',
+          }}
+        >
+          <span>${MIN_REWARD}</span>
+          <span>${MAX_REWARD}</span>
+        </div>
+      </section>
+
+      {filteredBounties.length === 0 ? (
+        <p style={{ color: '#64748b' }}>No bounties match the current minimum reward filter.</p>
+      ) : (
+        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '1rem' }}>
+          {filteredBounties.map((bounty) => (
+            <li
+              key={bounty.id}
+              style={{
+                padding: '1rem',
+                borderRadius: '0.75rem',
+                border: '1px solid #e2e8f0',
+                backgroundColor: '#ffffff',
+              }}
+            >
+              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
+                <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>{bounty.title}</h2>
+                <span style={{ fontWeight: 700, color: '#0ea5e9' }}>${bounty.reward}</span>
+              </div>
+              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
+                {bounty.tags.map((tag) => (
+                  <span
+                    key={tag}
+                    style={{
+                      fontSize: '0.75rem',
+                      padding: '0.25rem 0.5rem',
+                      borderRadius: '9999px',
+                      backgroundColor: '#e0f2fe',
+                      color: '#0369a1',
+                    }}
+                  >
+                    {tag}
+                  </span>
+                ))}
+                <span
+                  style={{
+                    fontSize: '0.75rem',
+                    padding: '0.25rem 0.5rem',
+                    borderRadius: '9999px',
+                    backgroundColor: '#f1f5f9',
+                    color: '#475569',
+                  }}
+                >
+                  {bounty.difficulty}
+                </span>
+              </div>
+            </li>
+          ))}
+        </ul>
+      )}
+    </div>
+  );
+}
