from lambda_handler import handler

if __name__ == "__main__":
    test_event = {}
    test_context = {}
    handler(test_event, test_context)
