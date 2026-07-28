from pathlib import Path
import ast
from django.core.management.base import BaseCommand

RISKY_OPERATIONS = (
    "AlterField",
    "RunSQL",
    "RemoveField",
    "RenameField",
    "AddConstraint",
    "AddField",
)

LARGE_TABLES = (
    "DailyActivity",
    "Notification",
    "UserSession",
    "LessonProgress",
)

class Command(BaseCommand):
    help = "Detect risky migrations on large tables"

    def handle(self, *args, **kwargs):
        root = Path("apps")
        if not root.exists():
            root = Path("backend/apps")

        warnings = []

        for migration in root.rglob("migrations/*.py"):
            text = migration.read_text(encoding="utf-8")
            
            try:
                tree = ast.parse(text)
            except SyntaxError:
                continue
                
            class MigrationVisitor(ast.NodeVisitor):
                def __init__(self, filename):
                    self.filename = filename
                    
                def visit_Call(self, node):
                    func = getattr(node.func, "attr", None)
                    
                    if func == "SeparateDatabaseAndState":
                        # We only care about database_operations, not state_operations
                        for kw in node.keywords:
                            if kw.arg == "database_operations":
                                self.visit(kw.value)
                        return # Do not visit state_operations

                    if func in RISKY_OPERATIONS:
                        targets_large_table = False
                        has_default = False
                        
                        for keyword in node.keywords:
                            if keyword.arg == "model_name":
                                if isinstance(keyword.value, ast.Constant):
                                    if str(keyword.value.value).lower() in [t.lower() for t in LARGE_TABLES]:
                                        targets_large_table = True
                            if keyword.arg == "field":
                                # Check if AddField has a non-null default
                                field_call = keyword.value
                                if isinstance(field_call, ast.Call):
                                    is_null = False
                                    has_def = False
                                    for fkw in field_call.keywords:
                                        if fkw.arg == "null" and getattr(fkw.value, "value", False) is True:
                                            is_null = True
                                        if fkw.arg == "default":
                                            has_def = True
                                    if has_def and not is_null:
                                        has_default = True

                        if func == "RunSQL":
                            sql_str = ""
                            for keyword in node.keywords:
                                if keyword.arg == "sql" and isinstance(keyword.value, ast.Constant):
                                    sql_str = str(keyword.value.value).lower()
                            if not sql_str and node.args:
                                if isinstance(node.args[0], ast.Constant):
                                    sql_str = str(node.args[0].value).lower()
                            
                            for t in LARGE_TABLES:
                                if t.lower() in sql_str:
                                    warnings.append(f"{self.filename.name}: {func} on {t}")
                        elif targets_large_table:
                            if func == "AddField" and has_default:
                                warnings.append(f"{self.filename.name}: {func} with default")
                            elif func in ("RemoveField", "RenameField"):
                                warnings.append(f"{self.filename.name}: {func}")
                                
                    self.generic_visit(node)
                    
            visitor = MigrationVisitor(migration)
            visitor.visit(tree)

        if warnings:
            self.stdout.write(self.style.WARNING("Risky migrations found:\n" + "\n".join(warnings)))
            raise SystemExit(1)

        self.stdout.write(self.style.SUCCESS("No risky migrations detected."))
