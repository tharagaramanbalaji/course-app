"""Seed 10 published, self-enrollable mock courses for local development.

Run from the backend directory (after `scripts/seed.py` has created users):

    .venv/Scripts/python scripts/seed_mock_courses.py

Safe to run repeatedly: a course is skipped if one with the same title
already exists for the seed instructor. Development only.
"""

import asyncio
import sys
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models.content import Content  # noqa: E402
from app.models.course import Course  # noqa: E402
from app.models.enums import ContentType, CourseStatus  # noqa: E402
from app.models.module import Module  # noqa: E402
from app.models.quiz import Answer, Question, Quiz  # noqa: E402
from app.models.user import User  # noqa: E402
from app.repositories.user import normalize_email  # noqa: E402

OWNER_EMAIL = "instructor@example.com"

# A short, freely embeddable sample clip used for every mock video lesson -
# there's no real per-course footage in a demo dataset, so one placeholder
# stands in everywhere rather than pretending each course has bespoke video.
SAMPLE_VIDEO_URL = "https://www.w3schools.com/html/mov_bbb.mp4"


def _module(
    title: str,
    description: str,
    *,
    reading_title: str,
    reading_body: str,
    video_title: str,
    quiz_title: str,
    question_text: str,
    correct_answer: str,
    wrong_answers: list[str],
) -> dict:
    return {
        "title": title,
        "description": description,
        "contents": [
            {"type": ContentType.TEXT, "title": reading_title, "body": reading_body},
            {"type": ContentType.VIDEO, "title": video_title, "url": SAMPLE_VIDEO_URL},
        ],
        "quiz": {
            "title": quiz_title,
            "passing_score": Decimal("70.00"),
            "max_attempts": 3,
            "questions": [
                {
                    "text": question_text,
                    "points": Decimal("10.00"),
                    "answers": [(correct_answer, True), *((w, False) for w in wrong_answers)],
                }
            ],
        },
    }


MOCK_COURSES = [
    {
        "title": "Frontend Foundations: HTML, CSS & JavaScript",
        "category": "Web Development",
        "description": (
            "Build a solid foundation in the three core web technologies. Learn "
            "semantic HTML, modern CSS layout, and JavaScript fundamentals through "
            "hands-on lessons and short quizzes."
        ),
        "modules": [
            _module(
                "Structuring Pages with HTML",
                "Semantic markup and page structure.",
                reading_title="Semantic HTML Elements",
                reading_body=(
                    "Semantic elements like <header>, <nav>, <main>, and <article> "
                    "describe the meaning of content, not just its appearance. Screen "
                    "readers and search engines rely on this structure, so reaching "
                    "for a semantic tag before a generic <div> makes a page more "
                    "accessible and easier to maintain."
                ),
                video_title="Building Your First Page",
                quiz_title="HTML Basics Quiz",
                question_text="Which element should wrap the main navigation links?",
                correct_answer="<nav>",
                wrong_answers=["<div>", "<section>"],
            ),
            _module(
                "Styling with CSS",
                "Layout, box model and responsive design.",
                reading_title="The CSS Box Model",
                reading_body=(
                    "Every element is a box made of content, padding, border and "
                    "margin. Understanding how these stack explains why elements "
                    "overlap, why spacing looks uneven, and how box-sizing: "
                    "border-box changes the math."
                ),
                video_title="Flexbox in Practice",
                quiz_title="CSS Layout Quiz",
                question_text="Which property enables a flex container?",
                correct_answer="display: flex",
                wrong_answers=["position: flex", "flex: container"],
            ),
        ],
    },
    {
        "title": "Python for Data Analysis",
        "category": "Data Science",
        "description": (
            "Get comfortable with Python's data tooling - pandas, NumPy and "
            "plotting - by working through realistic analysis tasks."
        ),
        "modules": [
            _module(
                "Working with pandas DataFrames",
                "Loading, filtering and transforming tabular data.",
                reading_title="DataFrames and Series",
                reading_body=(
                    "A DataFrame is a labelled 2D table; a Series is one labelled "
                    "column of it. Most analysis boils down to selecting rows with "
                    "boolean masks, grouping with groupby(), and reshaping with "
                    "pivot_table() - the same handful of operations recombined."
                ),
                video_title="Cleaning a Messy Dataset",
                quiz_title="pandas Fundamentals Quiz",
                question_text="Which method groups rows by a column's values?",
                correct_answer="groupby()",
                wrong_answers=["filter()", "sort_values()"],
            ),
            _module(
                "Visualizing Results",
                "Turning a DataFrame into a chart worth sharing.",
                reading_title="Choosing the Right Chart",
                reading_body=(
                    "A line chart shows change over time, a bar chart compares "
                    "categories, and a scatter plot reveals relationships between "
                    "two numeric variables. Picking the wrong one is the fastest way "
                    "to make a correct analysis look misleading."
                ),
                video_title="Plotting with matplotlib",
                quiz_title="Data Visualization Quiz",
                question_text="Which chart type best shows change over time?",
                correct_answer="Line chart",
                wrong_answers=["Pie chart", "Scatter plot"],
            ),
        ],
    },
    {
        "title": "Cloud Fundamentals on AWS",
        "category": "Cloud Computing",
        "description": (
            "Learn the core AWS services - compute, storage and networking - and "
            "the vocabulary you need to design a simple cloud architecture."
        ),
        "modules": [
            _module(
                "Compute and Storage Basics",
                "EC2, S3 and the shared responsibility model.",
                reading_title="EC2 vs. S3",
                reading_body=(
                    "EC2 gives you a virtual machine you manage yourself; S3 gives "
                    "you object storage you never have to patch or resize. Most "
                    "architectures use both: compute for logic, object storage for "
                    "anything that looks like a file."
                ),
                video_title="Launching Your First EC2 Instance",
                quiz_title="AWS Basics Quiz",
                question_text="Which AWS service provides object storage?",
                correct_answer="S3",
                wrong_answers=["EC2", "IAM"],
            ),
            _module(
                "Networking Essentials",
                "VPCs, subnets and security groups.",
                reading_title="Understanding VPCs",
                reading_body=(
                    "A VPC is an isolated network you define within AWS. Public "
                    "subnets route to the internet through an internet gateway; "
                    "private subnets don't. Security groups then act as a stateful "
                    "firewall around each resource inside it."
                ),
                video_title="Designing a Simple VPC",
                quiz_title="Networking Quiz",
                question_text="What acts as a firewall around an individual EC2 instance?",
                correct_answer="Security group",
                wrong_answers=["Internet gateway", "Route table"],
            ),
        ],
    },
    {
        "title": "Cybersecurity Essentials",
        "category": "Security",
        "description": (
            "An introduction to the threats every organisation faces and the "
            "practical defences - from strong authentication to safe browsing - "
            "that stop most of them."
        ),
        "modules": [
            _module(
                "Common Attack Vectors",
                "Phishing, malware and social engineering.",
                reading_title="Spotting a Phishing Email",
                reading_body=(
                    "Phishing succeeds by creating urgency: a locked account, an "
                    "unpaid invoice, a security alert. Checking the sender's actual "
                    "address and hovering over links before clicking catches most "
                    "attempts, since the display text rarely matches the real URL."
                ),
                video_title="Anatomy of a Phishing Attack",
                quiz_title="Threats Quiz",
                question_text="What is the primary goal of a phishing email?",
                correct_answer="Trick the recipient into acting quickly without checking",
                wrong_answers=["Slow down a network", "Encrypt files for ransom"],
            ),
            _module(
                "Authentication and Access Control",
                "Passwords, MFA and least privilege.",
                reading_title="Why MFA Matters",
                reading_body=(
                    "A stolen password alone is no longer enough to break into an "
                    "MFA-protected account, because the attacker also needs the "
                    "second factor - a code, a key, or a push approval - which "
                    "usually lives on a device they don't have."
                ),
                video_title="Setting Up Multi-Factor Authentication",
                quiz_title="Access Control Quiz",
                question_text="What does MFA require in addition to a password?",
                correct_answer="A second, independent factor",
                wrong_answers=["A longer password", "A password hint"],
            ),
        ],
    },
    {
        "title": "Product Management Fundamentals",
        "category": "Product",
        "description": (
            "Learn how product managers prioritise, write requirements and work "
            "with engineering to ship something users actually want."
        ),
        "modules": [
            _module(
                "Discovering the Right Problem",
                "User interviews and problem framing.",
                reading_title="Writing a Problem Statement",
                reading_body=(
                    "A good problem statement names the user, the pain point and "
                    "the evidence for it - not the solution. Jumping straight to "
                    "'we need a dashboard' skips the step where you find out "
                    "whether a dashboard is actually what's needed."
                ),
                video_title="Running a User Interview",
                quiz_title="Discovery Quiz",
                question_text="A good problem statement should NOT include which of these?",
                correct_answer="A specific proposed solution",
                wrong_answers=["The affected user", "Supporting evidence"],
            ),
            _module(
                "Prioritisation and Roadmapping",
                "Turning a backlog into a plan.",
                reading_title="RICE Scoring",
                reading_body=(
                    "RICE scores an idea on Reach, Impact, Confidence and Effort, "
                    "giving a comparable number across very different proposals. "
                    "It doesn't replace judgment, but it makes the tradeoffs behind "
                    "a prioritisation decision visible to the whole team."
                ),
                video_title="Building a Quarterly Roadmap",
                quiz_title="Prioritisation Quiz",
                question_text="In RICE, what does the 'E' stand for?",
                correct_answer="Effort",
                wrong_answers=["Engagement", "Execution"],
            ),
        ],
    },
    {
        "title": "DevOps and CI/CD Pipelines",
        "category": "DevOps",
        "description": (
            "Automate the path from commit to production: version control "
            "workflows, continuous integration, and deployment pipelines."
        ),
        "modules": [
            _module(
                "Continuous Integration Basics",
                "Automated builds and tests on every commit.",
                reading_title="What CI Actually Buys You",
                reading_body=(
                    "Continuous integration runs the test suite automatically on "
                    "every push, catching a broken build within minutes instead of "
                    "at the next release. The payoff scales with how often the team "
                    "merges - which is exactly why CI encourages small, frequent commits."
                ),
                video_title="Setting Up a CI Pipeline",
                quiz_title="CI Basics Quiz",
                question_text="What triggers a typical CI pipeline run?",
                correct_answer="A commit or pull request",
                wrong_answers=["A manual server restart", "A scheduled monthly job only"],
            ),
            _module(
                "Continuous Deployment",
                "Shipping automatically once checks pass.",
                reading_title="Blue-Green Deployments",
                reading_body=(
                    "A blue-green deployment keeps two identical environments and "
                    "switches traffic between them, so a bad release can be rolled "
                    "back by flipping the switch again rather than redeploying the "
                    "previous version from scratch."
                ),
                video_title="Deploying with Zero Downtime",
                quiz_title="CD Quiz",
                question_text="What is the main benefit of a blue-green deployment?",
                correct_answer="Near-instant rollback by switching traffic back",
                wrong_answers=["It requires only one environment", "It skips automated tests"],
            ),
        ],
    },
    {
        "title": "UX Design Principles",
        "category": "Design",
        "description": (
            "Core principles of usable, accessible interface design, from "
            "information hierarchy to usability testing."
        ),
        "modules": [
            _module(
                "Visual Hierarchy and Layout",
                "Guiding the eye with size, contrast and spacing.",
                reading_title="Establishing Visual Hierarchy",
                reading_body=(
                    "Size, weight, colour and whitespace all signal importance "
                    "before a user reads a single word. A page where everything is "
                    "bold and the same size forces the reader to do the hierarchy's "
                    "job themselves - and most won't bother."
                ),
                video_title="Redesigning a Cluttered Screen",
                quiz_title="Layout Quiz",
                question_text="Which technique most directly signals importance to a user?",
                correct_answer="Contrast in size and weight",
                wrong_answers=["Using as many colours as possible", "Centering all text"],
            ),
            _module(
                "Usability Testing",
                "Finding real problems before launch.",
                reading_title="Running a Five-User Test",
                reading_body=(
                    "Testing with just five users typically surfaces the majority "
                    "of a design's usability problems, because most issues are "
                    "obvious and shared across users rather than idiosyncratic to one."
                ),
                video_title="Observing a Usability Session",
                quiz_title="Usability Quiz",
                question_text="Roughly how many users are needed to find most usability issues?",
                correct_answer="About five",
                wrong_answers=["At least fifty", "Exactly one"],
            ),
        ],
    },
    {
        "title": "Mobile App Development with React Native",
        "category": "Mobile Development",
        "description": (
            "Build cross-platform mobile apps with React Native - components, "
            "navigation and talking to a backend API."
        ),
        "modules": [
            _module(
                "Core Components and Styling",
                "View, Text, and StyleSheet basics.",
                reading_title="React Native vs. React DOM",
                reading_body=(
                    "React Native swaps DOM elements like <div> for native "
                    "components like <View>, but keeps the same component model, "
                    "props and state. Styling uses a StyleSheet object instead of "
                    "CSS, though the properties will look familiar."
                ),
                video_title="Building a Login Screen",
                quiz_title="Components Quiz",
                question_text="Which component is the React Native equivalent of a <div>?",
                correct_answer="<View>",
                wrong_answers=["<Div>", "<Container>"],
            ),
            _module(
                "Navigation and Data Fetching",
                "Screens, stacks and calling an API.",
                reading_title="Stack Navigation",
                reading_body=(
                    "A stack navigator pushes each new screen on top of the last, "
                    "the same way browser history works. Going back pops the top "
                    "screen off, which is why passing params between screens should "
                    "happen at push time, not after the fact."
                ),
                video_title="Fetching Data from an API",
                quiz_title="Navigation Quiz",
                question_text="What does 'popping' a screen do in stack navigation?",
                correct_answer="Removes the top screen, returning to the previous one",
                wrong_answers=["Adds a new screen to the stack", "Reloads the current screen"],
            ),
        ],
    },
    {
        "title": "Introduction to Machine Learning",
        "category": "AI & Machine Learning",
        "description": (
            "The core concepts behind machine learning - supervised learning, "
            "model evaluation and overfitting - explained without heavy math."
        ),
        "modules": [
            _module(
                "Supervised Learning Basics",
                "Labels, features and training a model.",
                reading_title="What Makes Learning 'Supervised'",
                reading_body=(
                    "Supervised learning trains on examples that already have the "
                    "correct answer attached - a labelled dataset - so the model "
                    "can be scored against ground truth. Unsupervised learning, by "
                    "contrast, looks for structure with no labels at all."
                ),
                video_title="Training Your First Model",
                quiz_title="Supervised Learning Quiz",
                question_text="What does a supervised learning dataset require?",
                correct_answer="Labelled examples with known correct answers",
                wrong_answers=["No labels at all", "Only numerical features"],
            ),
            _module(
                "Evaluating Models",
                "Overfitting, train/test splits and accuracy.",
                reading_title="Why Train/Test Splits Matter",
                reading_body=(
                    "A model evaluated on the same data it trained on can look "
                    "perfect while having simply memorised the answers. Holding out "
                    "a test set the model never sees during training is what makes "
                    "the evaluation trustworthy."
                ),
                video_title="Detecting Overfitting",
                quiz_title="Model Evaluation Quiz",
                question_text="Why hold out a separate test set?",
                correct_answer="To check performance on data the model hasn't memorised",
                wrong_answers=["To train the model faster", "To reduce the dataset size"],
            ),
        ],
    },
    {
        "title": "Business Analytics with SQL",
        "category": "Business Analytics",
        "description": (
            "Answer real business questions with SQL - joins, aggregation and "
            "window functions applied to sales and operations data."
        ),
        "modules": [
            _module(
                "Aggregating and Grouping Data",
                "GROUP BY, HAVING and summary metrics.",
                reading_title="GROUP BY vs. WHERE",
                reading_body=(
                    "WHERE filters individual rows before grouping; HAVING filters "
                    "groups after aggregation. Trying to filter on a SUM() or "
                    "COUNT() inside a WHERE clause is a common mistake - that logic "
                    "belongs in HAVING instead."
                ),
                video_title="Building a Sales Summary Query",
                quiz_title="Aggregation Quiz",
                question_text="Which clause filters groups after aggregation?",
                correct_answer="HAVING",
                wrong_answers=["WHERE", "ORDER BY"],
            ),
            _module(
                "Joins and Window Functions",
                "Combining tables and ranking within groups.",
                reading_title="Window Functions Explained",
                reading_body=(
                    "A window function like RANK() OVER (PARTITION BY ...) "
                    "computes a value across a set of related rows without "
                    "collapsing them into one row the way GROUP BY does - useful "
                    "for 'top N per category' style questions."
                ),
                video_title="Ranking Products by Region",
                quiz_title="Joins and Windows Quiz",
                question_text="What does a window function do that GROUP BY does not?",
                correct_answer="Computes a value per row without collapsing the result set",
                wrong_answers=["Filters rows before aggregation", "Joins two tables"],
            ),
        ],
    },
]


async def main() -> None:
    async with AsyncSessionLocal() as session:
        owner = await session.scalar(
            select(User).where(User.email == normalize_email(OWNER_EMAIL))
        )
        if owner is None:
            print(f"No user {OWNER_EMAIL!r} found - run scripts/seed.py first.")
            return

        created = 0
        for course_data in MOCK_COURSES:
            existing = await session.scalar(
                select(Course).where(
                    Course.title == course_data["title"], Course.created_by == owner.id
                )
            )
            if existing is not None:
                print(f"  exists   {course_data['title']}")
                continue

            course = Course(
                title=course_data["title"],
                description=course_data["description"],
                category=course_data["category"],
                created_by=owner.id,
                status=CourseStatus.PUBLISHED,
                allow_self_enrollment=True,
                published_at=datetime.now(UTC),
            )
            session.add(course)
            await session.flush()

            for order, module_data in enumerate(course_data["modules"], start=1):
                module = Module(
                    course_id=course.id,
                    title=module_data["title"],
                    description=module_data["description"],
                    display_order=order,
                )
                session.add(module)
                await session.flush()

                for content_order, content_data in enumerate(module_data["contents"], start=1):
                    session.add(
                        Content(
                            module_id=module.id,
                            title=content_data["title"],
                            content_type=content_data["type"],
                            content_body=content_data.get("body"),
                            video_url=content_data.get("url"),
                            display_order=content_order,
                        )
                    )

                quiz_data = module_data["quiz"]
                quiz = Quiz(
                    module_id=module.id,
                    title=quiz_data["title"],
                    passing_score=quiz_data["passing_score"],
                    max_attempts=quiz_data["max_attempts"],
                )
                session.add(quiz)
                await session.flush()

                for q_order, question_data in enumerate(quiz_data["questions"], start=1):
                    question = Question(
                        quiz_id=quiz.id,
                        question_text=question_data["text"],
                        points=question_data["points"],
                        display_order=q_order,
                    )
                    session.add(question)
                    await session.flush()

                    for a_order, (answer_text, is_correct) in enumerate(
                        question_data["answers"], start=1
                    ):
                        session.add(
                            Answer(
                                question_id=question.id,
                                answer_text=answer_text,
                                is_correct=is_correct,
                                display_order=a_order,
                            )
                        )

            created += 1
            print(f"  created  {course_data['title']}")

        await session.commit()
        print(f"\n{created} course(s) created.")


if __name__ == "__main__":
    asyncio.run(main())
