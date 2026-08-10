import os
import time
import json
import urllib.request
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection

def get_omdb_api_key():
    env_path = os.path.join(settings.BASE_DIR, '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line.startswith('OMDB_API_KEY='):
                    val = line.split('=', 1)[1].strip().strip('"').strip("'")
                    if val:
                        return val
    return os.environ.get('OMDB_API_KEY', '')

class Command(BaseCommand):
    help = 'Synchronize IMDb IDs via TMDB external_ids and IMDb ratings via OMDb API'

    def add_arguments(self, parser):
        parser.add_argument('--refresh', action='store_true', help='Force refresh existing IMDb ratings')

    def handle(self, *args, **options):
        refresh = options.get('refresh', False)
        tmdb_key = getattr(settings, 'TMDB_API_KEY', '') or os.environ.get('TMDB_API_KEY', '')
        omdb_key = get_omdb_api_key()

        self.stdout.write("==================================================")
        self.stdout.write("CINEVERSE IMDb RATING SYNCHRONIZATION COMMAND")
        self.stdout.write("==================================================")
        self.stdout.write(f"TMDB API Key Available: {bool(tmdb_key)}")
        self.stdout.write(f"OMDb API Key Available: {bool(omdb_key)}")

        # Step 1: Populate missing imdb_id via TMDB external_ids
        imdb_ids_populated = 0
        with connection.cursor() as cursor:
            cursor.execute("SELECT movie_id, title, tmdb_id FROM movies WHERE (imdb_id IS NULL OR imdb_id = '') AND tmdb_id IS NOT NULL AND tmdb_id != ''")
            missing_imdb_rows = cursor.fetchall()

        self.stdout.write(f"\nStep 1: Finding IMDb IDs via TMDB external_ids for {len(missing_imdb_rows)} movies...")

        for m_id, title, tmdb_id in missing_imdb_rows:
            if not tmdb_key:
                break
            try:
                url = f"https://api.themoviedb.org/3/movie/{tmdb_id}/external_ids?api_key={tmdb_key}"
                req = urllib.request.Request(url, headers={'User-Agent': 'CineVerse/1.0'})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    data = json.loads(resp.read().decode())
                    imdb_id = data.get('imdb_id')
                    if imdb_id and str(imdb_id).startswith('tt'):
                        with connection.cursor() as cursor:
                            cursor.execute("UPDATE movies SET imdb_id = %s WHERE movie_id = %s", [imdb_id, m_id])
                        imdb_ids_populated += 1
                time.sleep(0.04)
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"  Error fetching TMDB external_id for movie {m_id}: {e}"))

        self.stdout.write(self.style.SUCCESS(f"Step 1 Complete: Populated {imdb_ids_populated} IMDb IDs!"))

        # Step 2: Fetch OMDb Ratings for movies with imdb_id
        if not omdb_key:
            self.stdout.write(self.style.WARNING("\nWARNING: OMDB_API_KEY is not set in Backend/.env. Skipping OMDb rating fetch."))
            return

        with connection.cursor() as cursor:
            if refresh:
                cursor.execute("SELECT movie_id, title, imdb_id FROM movies WHERE imdb_id IS NOT NULL AND imdb_id != ''")
            else:
                cursor.execute("SELECT movie_id, title, imdb_id FROM movies WHERE imdb_id IS NOT NULL AND imdb_id != '' AND imdb_rating IS NULL")
            target_movies = cursor.fetchall()

        self.stdout.write(f"\nStep 2: Fetching OMDb Ratings for {len(target_movies)} movies...")

        processed = 0
        ratings_updated = 0
        ratings_na = 0
        api_errors = 0

        for m_id, title, imdb_id in target_movies:
            processed += 1
            try:
                url = f"https://www.omdbapi.com/?i={imdb_id}&apikey={omdb_key}"
                req = urllib.request.Request(url, headers={'User-Agent': 'CineVerse/1.0'})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                    if data.get('Response') == 'True':
                        raw_rating = data.get('imdbRating')
                        if raw_rating and raw_rating != 'N/A':
                            try:
                                r_val = float(raw_rating)
                                with connection.cursor() as cursor:
                                    cursor.execute("UPDATE movies SET imdb_rating = %s WHERE movie_id = %s", [r_val, m_id])
                                ratings_updated += 1
                            except ValueError:
                                ratings_na += 1
                        else:
                            ratings_na += 1
                    else:
                        ratings_na += 1
                time.sleep(0.05)
            except Exception as e:
                api_errors += 1
                self.stdout.write(self.style.WARNING(f"  OMDb fetch error for movie {m_id} ({imdb_id}): {e}"))

        self.stdout.write("\n==================================================")
        self.stdout.write("SYNCHRONIZATION SUMMARY:")
        self.stdout.write(f"  Total Movies Processed: {processed}")
        self.stdout.write(f"  IMDb IDs Populated:     {imdb_ids_populated}")
        self.stdout.write(f"  IMDb Ratings Updated:   {ratings_updated}")
        self.stdout.write(f"  Ratings Unavailable:    {ratings_na}")
        self.stdout.write(f"  API Errors / Quota Exceeded: {api_errors}")
        self.stdout.write("==================================================")
