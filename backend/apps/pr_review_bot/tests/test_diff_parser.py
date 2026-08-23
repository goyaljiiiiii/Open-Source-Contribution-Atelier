from pathlib import Path
from apps.pr_review_bot.services.diff_parser import GitDiffParser, parse_git_diff

FIXTURE = Path(__file__).parent / "fixtures" / "rename_and_mode.diff"

def test_parse_multi_file_rename_and_mode_change():
    files = parse_git_diff(FIXTURE.read_text())
    assert len(files) == 2
    renamed = files[0]
    assert renamed.old_path == "backend/old_service.py"
    assert renamed.new_path == "backend/new_service.py"
    assert renamed.path == "backend/new_service.py"
    assert renamed.renamed is True
    assert renamed.old_mode == "100644"
    assert renamed.new_mode == "100755"
    assert renamed.mode_changed is True

def test_comment_uses_post_rename_path_and_new_line_position():
    anchor = GitDiffParser().map_comment(FIXTURE.read_text(), "backend/new_service.py", 12)
    assert anchor == {"path": "backend/new_service.py", "line": 12, "position": 3}

def test_old_rename_path_is_not_used_for_review_comments():
    parser = GitDiffParser()
    diff = FIXTURE.read_text()
    assert parser.file_for_comment(diff, "backend/new_service.py") is not None
    assert parser.file_for_comment(diff, "backend/old_service.py") is None

def test_non_renamed_file_still_maps_lines():
    anchor = GitDiffParser().map_comment(FIXTURE.read_text(), "backend/untouched.py", 2)
    assert anchor == {"path": "backend/untouched.py", "line": 2, "position": 3}
