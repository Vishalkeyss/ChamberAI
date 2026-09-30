import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface UserRoleAssignment {
  roleId: string;
  scopeType: 'chamber' | 'chapter' | 'group';
  scopeId: string;
}

export function checkScopeAccess(
  roles: UserRoleAssignment[],
  highestRole: string | null,
  requiredScopeType: 'chamber' | 'chapter' | 'group',
  targetScopeId: string
): boolean {
  if (highestRole === 'super_admin') return true;
  if (
    highestRole === 'full_admin' ||
    roles.some((r) => r.roleId === 'full_admin' && r.scopeType === 'chamber')
  ) {
    return true;
  }
  return roles.some(
    (r) => r.scopeType === requiredScopeType && r.scopeId === targetScopeId
  );
}

describe('Prompt 01.3: Client Scope Access & Multi-Role Scoping Algorithm', () => {
  it('grants access to super_admin across all chambers, chapters, and groups', () => {
    const roles: UserRoleAssignment[] = [{ roleId: 'super_admin', scopeType: 'chamber', scopeId: '*' }];
    assert.equal(checkScopeAccess(roles, 'super_admin', 'chapter', 'chap_any'), true);
    assert.equal(checkScopeAccess(roles, 'super_admin', 'group', 'grp_any'), true);
  });

  it('grants full_admin global access across all chapters and groups in their chamber', () => {
    const roles: UserRoleAssignment[] = [{ roleId: 'full_admin', scopeType: 'chamber', scopeId: 'ch_austin_001' }];
    assert.equal(checkScopeAccess(roles, 'full_admin', 'chapter', 'chap_north'), true);
    assert.equal(checkScopeAccess(roles, 'full_admin', 'chapter', 'chap_downtown'), true);
    assert.equal(checkScopeAccess(roles, 'full_admin', 'group', 'grp_tech_council'), true);
  });

  it('grants chapter_admin access to assigned chapter and blocks unassigned chapter', () => {
    const roles: UserRoleAssignment[] = [
      { roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' },
      { roleId: 'chapter_admin', scopeType: 'chapter', scopeId: 'chap_downtown' },
    ];
    // Assigned chapter -> allowed
    assert.equal(checkScopeAccess(roles, 'chapter_admin', 'chapter', 'chap_downtown'), true);
    // Different chapter -> denied
    assert.equal(checkScopeAccess(roles, 'chapter_admin', 'chapter', 'chap_north_suburbs'), false);
    // Group scope -> denied
    assert.equal(checkScopeAccess(roles, 'chapter_admin', 'group', 'grp_finance'), false);
  });

  it('grants group_admin access to assigned committee and blocks other committees', () => {
    const roles: UserRoleAssignment[] = [
      { roleId: 'member', scopeType: 'chamber', scopeId: 'ch_austin_001' },
      { roleId: 'group_admin', scopeType: 'group', scopeId: 'grp_tech_council' },
    ];
    assert.equal(checkScopeAccess(roles, 'group_admin', 'group', 'grp_tech_council'), true);
    assert.equal(checkScopeAccess(roles, 'group_admin', 'group', 'grp_healthcare'), false);
  });
});
