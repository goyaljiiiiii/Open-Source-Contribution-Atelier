from rest_framework import permissions, views
from rest_framework.response import Response

from .models import LocalizedContent

DEFAULT_LANG = "en"


class TranslationDictionaryView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, lang_code):
        requested = {
            item.key: item.translation
            for item in LocalizedContent.objects.filter(language_code=lang_code)
        }
        if lang_code == DEFAULT_LANG:
            return Response(requested)

        # Fall back to the default English string for any key that is missing
        # or empty in the requested locale.
        dictionary = {
            item.key: item.translation
            for item in LocalizedContent.objects.filter(language_code=DEFAULT_LANG)
        }
        for key, value in requested.items():
            if value:
                dictionary[key] = value
        return Response(dictionary)
