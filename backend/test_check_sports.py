from unittest.mock import MagicMock, patch
from scripts.check_sports import list_betfair_soccer_event_type, list_odds_api_soccer_sports


class FakeEventType:
    """Mimics betfairlightweight's EventTypeResult shape."""
    def __init__(self, name, id_):
        self.event_type = MagicMock()
        self.event_type.name = name
        self.event_type.id = id_


class TestListBetfairSoccerEventType:

    @patch("app.check_sports.BetfairService")
    def test_prints_only_soccer_football_matches(self, mock_betfair_cls, capsys):
        mock_instance = mock_betfair_cls.return_value
        mock_instance.get_event_types.return_value = [
            FakeEventType("Soccer", "1"),
            FakeEventType("Tennis", "2"),
            FakeEventType("American Football", "6423"),
            FakeEventType("Basketball", "7522"),
        ]

        list_betfair_soccer_event_type()

        output = capsys.readouterr().out
        assert "Soccer" in output
        assert "id=1" in output
        assert "American Football" in output
        assert "Tennis" not in output
        assert "Basketball" not in output

    @patch("app.check_sports.BetfairService")
    def test_calls_login_before_fetching(self, mock_betfair_cls):
        mock_instance = mock_betfair_cls.return_value
        mock_instance.get_event_types.return_value = []

        list_betfair_soccer_event_type()

        mock_instance.login.assert_called_once()
        mock_instance.get_event_types.assert_called_once()

    @patch("app.check_sports.BetfairService")
    def test_no_soccer_matches_prints_header_only(self, mock_betfair_cls, capsys):
        mock_instance = mock_betfair_cls.return_value
        mock_instance.get_event_types.return_value = [
            FakeEventType("Tennis", "2"),
        ]

        list_betfair_soccer_event_type()

        output = capsys.readouterr().out
        assert "Tennis" not in output


class TestListOddsApiSoccerSports:

    @patch("app.check_sports.requests.get")
    def test_prints_only_soccer_group_sports(self, mock_get, capsys):
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"key": "soccer_epl", "title": "EPL", "group": "Soccer", "active": True},
            {"key": "soccer_australia_aleague", "title": "A-League", "group": "Soccer", "active": False},
            {"key": "basketball_nba", "title": "NBA", "group": "Basketball", "active": True},
        ]
        mock_get.return_value = mock_response

        list_odds_api_soccer_sports()

        output = capsys.readouterr().out
        assert "soccer_epl" in output
        assert "soccer_australia_aleague" in output
        assert "basketball_nba" not in output

    @patch("app.check_sports.requests.get")
    def test_uses_odds_api_key_from_env(self, mock_get, monkeypatch):
        monkeypatch.setenv("ODDS_API_KEY", "fake-key-123")
        mock_response = MagicMock()
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        list_odds_api_soccer_sports()

        called_params = mock_get.call_args.kwargs["params"]
        assert called_params["apiKey"] == "fake-key-123"

    @patch("app.check_sports.requests.get")
    def test_no_active_soccer_sports_still_runs(self, mock_get, capsys):
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {"key": "soccer_epl", "title": "EPL", "group": "Soccer", "active": False},
        ]
        mock_get.return_value = mock_response

        list_odds_api_soccer_sports()

        output = capsys.readouterr().out
        assert "active=False" in output