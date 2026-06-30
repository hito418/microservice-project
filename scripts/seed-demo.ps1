param(
    [string]$DebateId = "demo-debate-1",
    [string]$ProfileUserId = "11111111-1111-1111-1111-111111111111"
)

$ErrorActionPreference = "Stop"

function Invoke-DemoPsql {
    param(
        [Parameter(Mandatory = $true)][string]$Service,
        [Parameter(Mandatory = $true)][string]$User,
        [Parameter(Mandatory = $true)][string]$Database,
        [Parameter(Mandatory = $true)][string]$Sql
    )

    $Sql | docker compose exec -T $Service psql -U $User -d $Database -v ON_ERROR_STOP=1
}

function Escape-SqlLiteral {
    param([Parameter(Mandatory = $true)][string]$Value)
    return $Value.Replace("'", "''")
}

$safeDebateId = Escape-SqlLiteral $DebateId
$safeProfileUserId = Escape-SqlLiteral $ProfileUserId

Write-Host "Seeding scoring demo data for debate '$DebateId'..."

$scoringSql = @'
insert into debates (id, status, created_at, updated_at)
values ('__DEBATE_ID__', 'VOTING', now(), now())
on conflict (id) do update set status = 'VOTING', updated_at = now();

insert into spectator_votes (debate_id, user_id, side)
values
('__DEBATE_ID__', 'demo-voter-1', 'FOR'),
('__DEBATE_ID__', 'demo-voter-2', 'FOR'),
('__DEBATE_ID__', 'demo-voter-3', 'FOR'),
('__DEBATE_ID__', 'demo-voter-4', 'AGAINST')
on conflict (debate_id, user_id) do nothing;

insert into debate_ai_analysis_results
    (debate_id, status, summary, for_score, against_score, for_feedback, against_feedback, updated_at)
values
    (
        '__DEBATE_ID__',
        'COMPLETED',
        'FOR presented clearer structure and stronger evidence. AGAINST raised useful objections but was less consistent.',
        78,
        66,
        'Strong framing, good use of examples, and clear closing argument.',
        'Good counterpoints, but the argument needs more evidence and tighter rebuttals.',
        now()
    )
on conflict (debate_id) do update set
    status = excluded.status,
    summary = excluded.summary,
    for_score = excluded.for_score,
    against_score = excluded.against_score,
    for_feedback = excluded.for_feedback,
    against_feedback = excluded.against_feedback,
    updated_at = now();

insert into debate_final_scores
    (
        debate_id,
        ai_for_score,
        ai_against_score,
        audience_for_score,
        audience_against_score,
        final_for_score,
        final_against_score,
        winner_side,
        updated_at
    )
values
    ('__DEBATE_ID__', 78, 66, 75, 25, 77, 46, 'FOR', now())
on conflict (debate_id) do update set
    ai_for_score = excluded.ai_for_score,
    ai_against_score = excluded.ai_against_score,
    audience_for_score = excluded.audience_for_score,
    audience_against_score = excluded.audience_against_score,
    final_for_score = excluded.final_for_score,
    final_against_score = excluded.final_against_score,
    winner_side = excluded.winner_side,
    updated_at = now();
'@.Replace("__DEBATE_ID__", $safeDebateId)

Invoke-DemoPsql -Service "scoring-db" -User "scoring" -Database "scoring" -Sql $scoringSql

Write-Host "Seeding optional profile stats for user '$ProfileUserId' when player_stats exists..."

$profileSql = @'
do $demo$
begin
    if to_regclass('public.player_stats') is not null then
        insert into player_stats
            (user_id, xp, elo, debates_count, wins, losses, draws, updated_at)
        values
            ('__PROFILE_USER_ID__', 240, 1420, 8, 5, 2, 1, now())
        on conflict (user_id) do update set
            xp = excluded.xp,
            elo = excluded.elo,
            debates_count = excluded.debates_count,
            wins = excluded.wins,
            losses = excluded.losses,
            draws = excluded.draws,
            updated_at = now();
    else
        raise notice 'player_stats table does not exist; skipping profile demo stats';
    end if;
end
$demo$;
'@.Replace("__PROFILE_USER_ID__", $safeProfileUserId)

Invoke-DemoPsql -Service "profile-db" -User "profile" -Database "profile" -Sql $profileSql

Write-Host "Demo seed complete."
Write-Host "Debate id: $DebateId"
Write-Host "Profile user id: $ProfileUserId"
