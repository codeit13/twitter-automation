import sys
import time
import threading


class Spinner(threading.Thread):
    def __init__(self, text):
        super().__init__()
        self.is_running = False
        self.text = text
        self.start_time = 0

    def run(self):
        print()
        self.is_running = True
        start_time = time.time()
        self.start_time = start_time
        spinner = "|/-\\"
        index = 0
        while self.is_running:
            elapsed_time = time.time() - start_time
            sys.stdout.write(f"\r{self.text} [{elapsed_time:.1f}s] {spinner[index]}")
            sys.stdout.flush()
            index = (index + 1) % len(spinner)
            time.sleep(0.1)

    def stop(self):
        self.is_running = False
        self.join()

    def finish(self):
        self.stop()
        elapsed_time = time.time() - self.start_time
        sys.stdout.write(f"\r{self.text} [{elapsed_time:.1f}s] ✅")
        sys.stdout.flush()


# Example usage:
spinner = Spinner("Loading")
spinner.start()
time.sleep(5)  # Simulate some work
spinner.finish()

# Call example usage again
spinner = Spinner("Processing")
spinner.start()
time.sleep(3)  # Simulate some work
spinner.finish()
