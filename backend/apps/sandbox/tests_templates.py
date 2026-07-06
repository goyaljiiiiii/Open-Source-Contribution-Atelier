from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from .models import TemplateCategory, ProjectTemplate, TemplateFile, Project, ProjectFile

User = get_user_model()

class ProjectTemplateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="password", email="test@example.com")
        self.other_user = User.objects.create_user(username="otheruser", password="password", email="other@example.com")
        
        self.category = TemplateCategory.objects.create(name="Web Development", description="Web dev templates")
        
        self.public_template = ProjectTemplate.objects.create(
            category=self.category,
            name="Public React",
            description="A public React template",
            language="javascript",
            is_public=True,
            author=self.other_user
        )
        TemplateFile.objects.create(template=self.public_template, path="package.json", content='{"name": "react"}')
        TemplateFile.objects.create(template=self.public_template, path="src/index.js", content='console.log("Hello")')
        
        self.private_template = ProjectTemplate.objects.create(
            category=self.category,
            name="Private Secret Template",
            description="A private template",
            language="python",
            is_public=False,
            author=self.user
        )
        
        self.other_private_template = ProjectTemplate.objects.create(
            category=self.category,
            name="Other User Private",
            description="Should not be visible to testuser",
            language="python",
            is_public=False,
            author=self.other_user
        )

    def test_list_template_categories(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('template-category-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Handle both paginated and non-paginated responses
        data = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['name'], "Web Development")

    def test_list_project_templates_visibility(self):
        """Test that users can only see public templates or their own private templates."""
        self.client.force_authenticate(user=self.user)
        url = reverse('template-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Handle both paginated and non-paginated responses
        data = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        # Should see public_template and private_template, but NOT other_private_template
        template_names = [t['name'] for t in data]
        self.assertIn("Public React", template_names)
        self.assertIn("Private Secret Template", template_names)
        self.assertNotIn("Other User Private", template_names)
        self.assertEqual(len(template_names), 2)

    def test_instantiate_template_success(self):
        """Test that instantiating a template creates a new project with all template files."""
        self.client.force_authenticate(user=self.user)
        url = reverse('template-instantiate', kwargs={'pk': self.public_template.id})
        
        initial_use_count = self.public_template.use_count
        
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('project_id', response.data)
        
        # Verify the project was created
        project_id = response.data['project_id']
        project = Project.objects.get(id=project_id)
        self.assertEqual(project.user, self.user)
        self.assertEqual(project.name, "Public React Project")
        
        # Verify files were created
        files = ProjectFile.objects.filter(project=project)
        self.assertEqual(files.count(), 2)
        paths = [f.path for f in files]
        self.assertIn("package.json", paths)
        self.assertIn("src/index.js", paths)
        
        # Verify language is preserved
        self.assertTrue(all(f.language == "javascript" for f in files))
        
        # Verify use count was incremented
        self.public_template.refresh_from_db()
        self.assertEqual(self.public_template.use_count, initial_use_count + 1)

    def test_instantiate_template_unauthenticated(self):
        url = reverse('template-instantiate', kwargs={'pk': self.public_template.id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_instantiate_nonexistent_template(self):
        self.client.force_authenticate(user=self.user)
        import uuid
        url = reverse('template-instantiate', kwargs={'pk': uuid.uuid4()})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_custom_template(self):
        self.client.force_authenticate(user=self.user)
        url = reverse('template-list')
        data = {
            "name": "My Custom Template",
            "category": self.category.id,
            "description": "Custom stuff",
            "language": "typescript",
            "is_public": False,
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        template = ProjectTemplate.objects.get(id=response.data['id'])
        self.assertEqual(template.author, self.user)
        self.assertEqual(template.name, "My Custom Template")
        self.assertFalse(template.is_public)
