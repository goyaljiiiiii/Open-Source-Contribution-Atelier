from django.test import TestCase, RequestFactory
from django.contrib.auth import get_user_model
from apps.search.models import SearchDocument
from apps.content.models import Lesson
from apps.search.tasks import index_model_for_search, remove_model_from_search
from apps.search.views import UnifiedSearchView

User = get_user_model()

class SearchEngineEdgeCaseTests(TestCase):
    def setUp(self):
        # Create test models
        self.user = User.objects.create_user(username="searchtestuser", email="test@search.com")
        self.lesson1 = Lesson.objects.create(
            difficulty="Beginner",
            title="Introduction to React",
            slug="intro-to-react",
            summary="A comprehensive guide to React hooks.",
            content="Use useState and useEffect for side effects."
        )
        self.lesson2 = Lesson.objects.create(
            difficulty="Advanced",
            title="Advanced Python Programming",
            slug="advanced-python",
            summary="Deep dive into Python internals.",
            content="Understanding the GIL, metaclasses, and memory management."
        )
        
        # Manually index them
        self._index_model(self.user, self.user.username, self.user.email)
        self._index_model(self.lesson1, self.lesson1.title, f"{self.lesson1.summary} {self.lesson1.content}")
        self._index_model(self.lesson2, self.lesson2.title, f"{self.lesson2.summary} {self.lesson2.content}")
        
        self.factory = RequestFactory()
        self.view = UnifiedSearchView.as_view()

    def _index_model(self, obj, title, body):
        index_model_for_search(
            app_label=obj._meta.app_label,
            model_name=obj._meta.model_name,
            object_id=obj.pk,
            title=title,
            body_text=body
        )

    def test_empty_query(self):
        """Edge Case: Query is completely empty."""
        request = self.factory.get('/api/search/', {'q': ''})
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 0)

    def test_special_characters(self):
        """Edge Case: Query contains special SQL or regex characters."""
        request = self.factory.get('/api/search/', {'q': '%_**&&\\'})
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        # Should cleanly return empty, not throw syntax error
        self.assertEqual(len(response.data), 0)

    def test_typo_tolerance_trigram(self):
        """Custom Case: User types 'Pethon' instead of 'Python'."""
        request = self.factory.get('/api/search/', {'q': 'Pethon'})
        response = self.view(request)
        
        self.assertEqual(response.status_code, 200)
        # Should still find the "Advanced Python Programming" lesson!
        self.assertGreater(len(response.data), 0)
        self.assertEqual(response.data[0]['title'], "Advanced Python Programming")

    def test_exact_full_text_search(self):
        """Custom Case: Standard Full-Text Search exact matching."""
        request = self.factory.get('/api/search/', {'q': 'React'})
        response = self.view(request)
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['title'], "Introduction to React")

    def test_polymorphic_serializer_response(self):
        """Ensure the response formats the URL appropriately for different models."""
        request = self.factory.get('/api/search/', {'q': 'searchtestuser'})
        response = self.view(request)
        
        self.assertEqual(response.status_code, 200)
        data = response.data[0]
        self.assertEqual(data['type'], 'User')
        self.assertTrue(data['url'].startswith('/api/users/'))
