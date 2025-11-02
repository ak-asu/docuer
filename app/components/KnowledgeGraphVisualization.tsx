"use client";

import { useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Card, CardBody, CardHeader, Button, Chip } from "@heroui/react";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import type { Article } from "@/lib/store/useStore";
import { useStore } from "@/lib/store/useStore";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

interface GraphNode {
  id: string;
  name: string;
  type: "topic" | "article";
  completed?: boolean;
  difficulty?: string;
  inLearningPath?: boolean;
  val?: number;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  type: "prerequisite" | "related";
  value?: number;
}

interface KnowledgeGraphVisualizationProps {
  articles: Article[];
  courseId: string;
  onNodeClick?: (articleId: string) => void;
}

export default function KnowledgeGraphVisualization({
  articles,
  onNodeClick,
}: KnowledgeGraphVisualizationProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const userProfile = useStore((state) => state.userProfile);

  // Compute graph data using useMemo to avoid unnecessary re-renders
  const graphData = useMemo(() => {
    const userLevel = userProfile.level || "beginner";
    const userInterests = (userProfile.interests || []).map((i) =>
      i.toLowerCase(),
    );
    const userGoals = (userProfile.learningGoals || []).map((g) =>
      g.toLowerCase(),
    );

    // Determine learning path with intelligent multi-factor scoring
    const completedIds = new Set(
      articles.filter((a) => a.completed).map((a) => a.id),
    );
    const learningPathIds = new Set<string>();

    // Calculate personalized score for each article
    const levelPriority: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      advanced: 3,
    };
    const userLevelPriority = levelPriority[userLevel];

    articles.forEach((article) => {
      if (article.completed) return;

      // Multi-factor scoring system
      let score = 0;

      // 1. Difficulty match (35% weight)
      const articleDifficulty = article.difficulty || "intermediate";
      const articlePriority = levelPriority[articleDifficulty];
      const difficultyScore = (() => {
        if (articleDifficulty === userLevel) return 1.0; // Perfect match
        if (articlePriority <= userLevelPriority) return 0.7; // Within range
        return 0.0; // Too advanced
      })();
      score += difficultyScore * 0.35;

      // 2. Interest alignment (25% weight)
      const interestScore = (() => {
        if (userInterests.length === 0) return 0.5; // Neutral if no interests
        const title = article.title.toLowerCase();

        // Direct match
        if (userInterests.some((interest) => title.includes(interest)))
          return 1.0;
        // Partial word match
        if (
          userInterests.some((interest) =>
            title
              .split(" ")
              .some(
                (word) => word.includes(interest) || interest.includes(word),
              ),
          )
        )
          return 0.8;

        return 0.2; // Minimum score
      })();
      score += interestScore * 0.25;

      // 3. Goal relevance (25% weight)
      const goalScore = (() => {
        if (userGoals.length === 0) return 0.5; // Neutral if no goals
        const title = article.title.toLowerCase();

        // Direct match
        if (userGoals.some((goal) => title.includes(goal))) return 1.0;
        // Partial word match
        if (
          userGoals.some((goal) =>
            title
              .split(" ")
              .some((word) => word.includes(goal) || goal.includes(word)),
          )
        )
          return 0.7;

        return 0.3; // Minimum score for goals
      })();
      score += goalScore * 0.25;

      // 4. Prerequisite readiness (15% weight)
      const prereqScore = (() => {
        if (!article.relatedArticles || article.relatedArticles.length === 0) {
          return 1.0; // Foundation topic - highly ready
        }
        const completedPrereqs = article.relatedArticles.filter((id) =>
          completedIds.has(id),
        ).length;
        return completedPrereqs / article.relatedArticles.length;
      })();
      score += prereqScore * 0.15;

      // Log scoring details for debugging
      if (process.env.NODE_ENV === "development") {
        console.log(`📊 Article: ${article.title}`);
        console.log(
          `  - Difficulty: ${difficultyScore.toFixed(2)} (${(difficultyScore * 0.35).toFixed(2)} weighted)`,
        );
        console.log(
          `  - Interest: ${interestScore.toFixed(2)} (${(interestScore * 0.25).toFixed(2)} weighted)`,
        );
        console.log(
          `  - Goal: ${goalScore.toFixed(2)} (${(goalScore * 0.25).toFixed(2)} weighted)`,
        );
        console.log(
          `  - Prereq: ${prereqScore.toFixed(2)} (${(prereqScore * 0.15).toFixed(2)} weighted)`,
        );
        console.log(`  - Total Score: ${score.toFixed(2)}`);
      }

      // Include in learning path based on score
      // For fresh courses, allow articles with fewer prerequisites
      const prereqsMet =
        prereqScore === 1.0 || // Foundation topics (no prereqs)
        prereqScore >= 0.5 || // At least 50% of prereqs completed
        (completedIds.size === 0 && prereqScore >= 0.3); // First-time learners: more lenient

      // Dynamic threshold: lower for beginners or fresh courses
      const scoreThreshold = completedIds.size === 0 ? 0.35 : 0.4;

      if (score >= scoreThreshold && prereqsMet) {
        learningPathIds.add(article.id);
        if (process.env.NODE_ENV === "development") {
          console.log(`  ✅ INCLUDED in learning path`);
        }
      } else if (process.env.NODE_ENV === "development") {
        console.log(
          `  ❌ EXCLUDED: score=${score.toFixed(2)} (need ≥0.4), prereqsMet=${prereqsMet}`,
        );
      }
    });

    if (process.env.NODE_ENV === "development") {
      console.log(
        `\n📈 Learning Path Summary: ${learningPathIds.size}/${articles.length} articles included`,
      );
    }

    const nodes: GraphNode[] = articles.map((article) => ({
      id: article.id,
      name: article.title,
      type: "article",
      completed: article.completed,
      inLearningPath: learningPathIds.has(article.id),
      difficulty: article.completed
        ? "completed"
        : learningPathIds.has(article.id)
          ? "in-path"
          : "future",
      val: article.completed ? 15 : learningPathIds.has(article.id) ? 12 : 10,
    }));

    const links: GraphLink[] = [];

    articles.forEach((article, index) => {
      if (article.relatedArticles && article.relatedArticles.length > 0) {
        article.relatedArticles.forEach((relatedId) => {
          const relatedArticle = articles.find((a) => a.id === relatedId);
          if (relatedArticle) {
            const existingLink = links.find(
              (l) =>
                (l.source === article.id && l.target === relatedId) ||
                (l.source === relatedId && l.target === article.id),
            );
            if (!existingLink) {
              links.push({
                source: article.id,
                target: relatedId,
                type: "related",
                value: 1,
              });
            }
          }
        });
      }

      if (index > 0 && article.relatedArticles.length === 0) {
        links.push({
          source: articles[index - 1].id,
          target: article.id,
          type: "prerequisite",
          value: 2,
        });
      }
    });

    return { nodes, links };
  }, [
    articles,
    userProfile.level,
    userProfile.interests,
    userProfile.learningGoals,
  ]);

  // Compute dimensions based on fullscreen state
  const dimensions = useMemo(() => {
    if (typeof window === "undefined") {
      return { width: 800, height: 500 };
    }
    return isFullscreen
      ? { width: window.innerWidth - 40, height: window.innerHeight - 120 }
      : { width: 800, height: 500 };
  }, [isFullscreen]);

  const handleNodeClick = (node: unknown) => {
    const graphNode = node as GraphNode;
    if (onNodeClick && graphNode.type === "article") {
      onNodeClick(graphNode.id);
    }
  };

  const handleReset = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400);
    }
  };

  const getNodeColor = (node: GraphNode) => {
    if (node.completed) return "#10b981"; // Green for completed
    if (node.inLearningPath) return "#3b82f6"; // Blue for learning path
    return "#9ca3af"; // Gray for future/not in path
  };

  const getLinkColor = (link: GraphLink) => {
    return link.type === "prerequisite"
      ? "rgba(99, 102, 241, 0.6)" // Purple for prerequisites
      : "rgba(156, 163, 175, 0.4)"; // Gray for related
  };

  return (
    <Card className={`${isFullscreen ? "fixed inset-4 z-50" : "relative"}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">Knowledge Graph</h3>
          <p className="text-sm text-gray-600">
            Explore topic relationships and prerequisites
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={handleReset}
            title="Reset view"
          >
            <RefreshCw size={18} />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </Button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex flex-col gap-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 items-center text-sm">
            <Chip size="sm" style={{ backgroundColor: "#10b981" }}>
              Completed
            </Chip>
            <Chip size="sm" style={{ backgroundColor: "#3b82f6" }}>
              Learning Path
            </Chip>
            <Chip size="sm" style={{ backgroundColor: "#9ca3af" }}>
              Not in Path
            </Chip>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-0.5"
                style={{ backgroundColor: "rgba(99, 102, 241, 0.6)" }}
              />
              <span className="text-gray-600">Prerequisite</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-0.5"
                style={{ backgroundColor: "rgba(156, 163, 175, 0.4)" }}
              />
              <span className="text-gray-600">Related</span>
            </div>
          </div>

          {/* Graph */}
          <div
            className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            style={{
              width: dimensions.width,
              height: dimensions.height,
            }}
          >
            {graphData.nodes.length > 0 ? (
              <ForceGraph2D
                ref={graphRef}
                graphData={graphData}
                width={dimensions.width}
                height={dimensions.height}
                nodeLabel={(node) =>
                  `${(node as GraphNode).name}${(node as GraphNode).completed ? " ✓" : ""}`
                }
                nodeColor={(node) => getNodeColor(node as GraphNode)}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const graphNode = node as GraphNode;
                  const label = graphNode.name;
                  const fontSize = 12 / globalScale;
                  ctx.font = `${fontSize}px Sans-Serif`;
                  const textWidth = ctx.measureText(label).width;
                  const bckgDimensions = [textWidth, fontSize].map(
                    (n) => n + fontSize * 0.4,
                  );

                  // Draw node circle
                  ctx.fillStyle = getNodeColor(graphNode);
                  ctx.beginPath();
                  ctx.arc(
                    graphNode.x || 0,
                    graphNode.y || 0,
                    graphNode.val || 5,
                    0,
                    2 * Math.PI,
                    false,
                  );
                  ctx.fill();

                  // Draw label background
                  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                  ctx.fillRect(
                    (graphNode.x || 0) - bckgDimensions[0] / 2,
                    (graphNode.y || 0) - (graphNode.val || 5) - fontSize - 2,
                    bckgDimensions[0],
                    bckgDimensions[1],
                  );

                  // Draw label text
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillStyle = "#1f2937";
                  ctx.fillText(
                    label,
                    graphNode.x || 0,
                    (graphNode.y || 0) -
                      (graphNode.val || 5) -
                      fontSize / 2 -
                      2,
                  );

                  // Draw checkmark if completed
                  if (graphNode.completed) {
                    ctx.fillStyle = "#ffffff";
                    ctx.font = `${(graphNode.val || 5) * 1.2}px Sans-Serif`;
                    ctx.fillText("✓", graphNode.x || 0, graphNode.y || 0);
                  }
                }}
                linkColor={(link) => getLinkColor(link as GraphLink)}
                linkWidth={(link) => ((link as GraphLink).value || 1) * 2}
                linkDirectionalArrowLength={6}
                linkDirectionalArrowRelPos={1}
                linkCurvature={0.15}
                onNodeClick={handleNodeClick}
                enableNodeDrag={true}
                cooldownTicks={100}
                onEngineStop={() => graphRef.current?.zoomToFit(400)}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="text-lg font-medium">No graph data available</p>
                  <p className="text-sm">
                    Articles will appear here as they are created
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
