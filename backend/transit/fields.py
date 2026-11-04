from django.db import models

class GeographyPointField(models.Field):
    """
    PostGIS geography(Point, 4326) field representation.
    When PostGIS extension is installed in PostgreSQL, emits 'geography(Point, 4326)'.
    If running against an instance without PostGIS pre-configured, gracefully defaults
    to 'text' so migrations can initialize before spatial extension is provisioned.
    """
    description = "PostGIS Geography Point (SRID 4326)"

    def db_type(self, connection):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'postgis';")
                if cursor.fetchone():
                    return "geography(Point, 4326)"
        except Exception:
            pass
        return "text"


class GeographyLineStringField(models.Field):
    """
    PostGIS geography(LineString, 4326) field representation.
    When PostGIS extension is installed in PostgreSQL, emits 'geography(LineString, 4326)'.
    If running against an instance without PostGIS pre-configured, gracefully defaults
    to 'text' so migrations can initialize before spatial extension is provisioned.
    """
    description = "PostGIS Geography LineString (SRID 4326)"

    def db_type(self, connection):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'postgis';")
                if cursor.fetchone():
                    return "geography(LineString, 4326)"
        except Exception:
            pass
        return "text"
