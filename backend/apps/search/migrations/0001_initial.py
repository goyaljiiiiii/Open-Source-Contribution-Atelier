from django.db import migrations, models
import django.db.models.deletion
import django.contrib.postgres.indexes
import django.contrib.postgres.search
from django.contrib.postgres.operations import TrigramExtension

class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
    ]

    operations = [
        TrigramExtension(), # Required for fuzzy typo-tolerant searching
        migrations.CreateModel(
            name='SearchDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('object_id', models.PositiveIntegerField()),
                ('title', models.CharField(max_length=255)),
                ('body_text', models.TextField()),
                ('search_vector', django.contrib.postgres.search.SearchVectorField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('content_type', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='contenttypes.contenttype')),
            ],
        ),
        migrations.AddIndex(
            model_name='searchdocument',
            index=django.contrib.postgres.indexes.GinIndex(fields=['search_vector'], name='search_vector_gin_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='searchdocument',
            unique_together={('content_type', 'object_id')},
        ),
    ]
